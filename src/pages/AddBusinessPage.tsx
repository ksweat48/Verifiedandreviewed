import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Upload, X, Plus, MapPin, Clock, Phone, Globe, DollarSign, Tag } from 'lucide-react';
import { BusinessService } from '../services/businessService';
import { useAuth } from '../hooks/useAuth';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';
import { supabase } from '../services/supabaseClient';
import { resizeImage } from '../utils/imageResizer';

interface UploadedImage {
  file: File | null;
  preview: string;
}

interface FormData {
  name: string;
  address: string;
  city: string;
  state: string;
  category: string;
  tags: string[];
  description: string;
  short_description: string;
  hours: string;
  days_closed: string;
  phone_number: string;
  website_url: string;
  social_media: string[];
  price_range: string;
}

export default function AddBusinessPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const editBusinessId = searchParams.get('edit');
  const isEditMode = !!editBusinessId;

  const [formData, setFormData] = useState<FormData>({
    name: '',
    address: '',
    city: '',
    state: '',
    category: '',
    tags: [],
    description: '',
    short_description: '',
    hours: '',
    days_closed: '',
    phone_number: '',
    website_url: '',
    social_media: [],
    price_range: '',
  });

  const [coverImage, setCoverImage] = useState<UploadedImage | null>(null);
  const [newTag, setNewTag] = useState('');
  const [newSocialMedia, setNewSocialMedia] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeocodingAddress, setIsGeocodingAddress] = useState(false);
  const [geocodingError, setGeocodingError] = useState<string>('');

  // Helper function to upload image to Supabase Storage
  const uploadImageToSupabase = async (file: File, imageType: 'cover'): Promise<string | null> => {
    try {
      if (!user) {
        throw new Error('User not authenticated');
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
      const filePath = `${user.id}/businesses/${imageType}/${fileName}`;

      console.log('📤 Uploading image to Supabase:', filePath);

      const { error: uploadError } = await supabase.storage
        .from('review-images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      const { data } = supabase.storage
        .from('review-images')
        .getPublicUrl(filePath);

      console.log('✅ Image uploaded successfully:', data.publicUrl);
      return data.publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      return null;
    }
  };

  // Fetch business data if in edit mode
  useEffect(() => {
    if (isEditMode && editBusinessId) {
      const fetchBusinessData = async () => {
        try {
          const business = await BusinessService.getBusinessById(editBusinessId);
          if (business) {
            // Parse location into city and state
            let initialCity = '';
            let initialState = '';
            if (business.location) {
              const locationParts = business.location.split(',').map(part => part.trim());
              if (locationParts.length > 0) {
                initialCity = locationParts[0];
                if (locationParts.length > 1) {
                  initialState = locationParts[1];
                }
              }
            }

            setFormData({
              name: business.name || '',
              address: business.address || '',
              city: initialCity,
              state: initialState,
              category: business.category || '',
              tags: business.tags || [],
              description: business.description || '',
              short_description: business.short_description || '',
              hours: business.hours || '',
              days_closed: business.days_closed || '',
              phone_number: business.phone_number || '',
              website_url: business.website_url || '',
              social_media: business.social_media || [],
              price_range: business.price_range || '',
            });

            // Set cover image if exists
            if (business.image_url) {
              setCoverImage({
                file: null,
                preview: business.image_url
              });
            }
          }
        } catch (error) {
          console.error('Error fetching business data:', error);
        }
      };

      fetchBusinessData();
    }
  }, [isEditMode, editBusinessId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'cover') => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const processImages = async () => {
      try {
        if (type === 'cover' && files[0]) {
          console.log('📤 Resizing cover image...');
          const resizedFile = await resizeImage(files[0], 1200, 800, 0.8); // Max 1200px width, 800px height, 80% quality
          setCoverImage({
            file: resizedFile,
            preview: URL.createObjectURL(resizedFile)
          });
          console.log('✅ Cover image resized successfully');
        }
      } catch (error) {
        console.error('Error resizing image:', error);
        alert('Failed to process image. Please try a different file or a smaller image.');
      }
    };
    
    processImages();
  };

  const removeImage = (type: 'cover') => {
    if (type === 'cover') {
      if (coverImage?.preview && coverImage.file) {
        URL.revokeObjectURL(coverImage.preview);
      }
      setCoverImage(null);
    }
  };

  // Geocode address when user finishes typing
  const handleAddressBlur = async () => {
    if (!formData.address.trim()) return;
    
    setIsGeocodingAddress(true);
    setGeocodingError('');
    
    try {
      const response = await fetchWithTimeout('/.netlify/functions/geocode-address', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ address: formData.address }),
        timeout: 15000 // 15 second timeout for geocoding
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          console.warn('Geocoding service not available in current environment. Run "netlify dev" to enable Netlify Functions.');
          setGeocodingError('Address verification unavailable in development mode');
          return;
        }
        throw new Error(`Geocoding service unavailable (${response.status})`);
      }
      
      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error('Failed to parse geocoding response:', jsonError);
        throw new Error('Geocoding service returned invalid response');
      }
      
      if (data.success) {
        // Optionally update the address with the formatted version
        if (data.formattedAddress && data.formattedAddress !== formData.address) {
          setFormData(prev => ({
            ...prev,
            address: data.formattedAddress
          }));
        }
        
        console.log('✅ Address geocoded successfully:', {
          latitude: data.latitude,
          longitude: data.longitude
        });
      } else {
        setGeocodingError(data.error || 'Could not verify address location');
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      setGeocodingError(error instanceof Error ? error.message : 'Could not verify address location');
    } finally {
      setIsGeocodingAddress(false);
    }
  };

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }));
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const addSocialMedia = () => {
    if (newSocialMedia.trim() && !formData.social_media.includes(newSocialMedia.trim())) {
      setFormData(prev => ({
        ...prev,
        social_media: [...prev.social_media, newSocialMedia.trim()]
      }));
      setNewSocialMedia('');
    }
  };

  const removeSocialMedia = (urlToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      social_media: prev.social_media.filter(url => url !== urlToRemove)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSubmitting(true);

    try {
      let coverImageUrl = '';

      // Handle cover image upload
      if (coverImage) {
        if (coverImage.file) {
          console.log('📤 Uploading cover image...');
          const uploadedUrl = await uploadImageToSupabase(coverImage.file, 'cover');
          if (uploadedUrl) {
            coverImageUrl = uploadedUrl;
          } else {
            throw new Error('Failed to upload cover image');
          }
        } else {
          // Existing image URL
          coverImageUrl = coverImage.preview;
        }
      }

      console.log('📊 Final image URLs:', { coverImageUrl });

      const businessData = {
        ...formData,
        location: `${formData.city.trim()}${formData.state.trim() ? ', ' + formData.state.trim() : ''}`,
        image_url: coverImageUrl,
        // Default to physical business
        is_mobile_business: false,
        is_virtual: false,
      };

      if (isEditMode && editBusinessId) {
        console.log('✏️ Updating business with image URLs...');
        await BusinessService.updateBusiness(editBusinessId, businessData);
      } else {
        console.log('➕ Creating business with image URLs...');
        await BusinessService.createBusiness(businessData, user.id);
      }

      navigate('/dashboard');
    } catch (error) {
      console.error('Error saving business:', error);
      alert(`Error saving business: ${error instanceof Error ? error.message : 'Please try again.'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <div className="mb-8">
            <h1 className="font-cinzel text-3xl font-bold text-neutral-900">
              {isEditMode ? 'Edit Your Business' : 'Add Your Business'}
            </h1>
            <p className="text-gray-600 mt-2">
              {isEditMode ? 'Update your business information' : 'Share your business with the community'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Basic Information */}
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">Basic Information</h2>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Business Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., 'Sunrise Wellness Studio' or 'The Cozy Corner Cafe'"
                />
                <p className="font-lora text-xs text-gray-500 mt-1">
                  Use descriptive names that convey your business type and atmosphere
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Short Description
                </label>
                <input
                  type="text"
                  name="short_description"
                  value={formData.short_description}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., 'Cozy neighborhood cafe with organic coffee and fresh pastries'"
                  maxLength={100}
                />
                <p className="font-lora text-xs text-gray-500 mt-1">
                  <span className={formData.short_description.length >= 50 ? 'text-green-600' : 'text-gray-500'}>
                    {formData.short_description.length}/100 characters
                  </span>
                  {formData.short_description.length < 50 && ' - Aim for 50+ characters'}
                  . Focus on your core service and unique vibe (e.g., "cozy", "vibrant", "upscale").
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Describe your services, unique selling points, atmosphere, and what customers can expect. Include details about your vibe, target audience, and what makes you special..."
                />
                <p className="font-lora text-xs text-gray-500 mt-1">
                  <span className={formData.description.length >= 150 ? 'text-green-600' : 'text-gray-500'}>
                    {formData.description.length} characters
                  </span>
                  {formData.description.length < 150 && ' - Aim for 150+ characters (about 25-50 words)'}
                  . Include atmosphere, services, target audience, and unique features.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category *
                </label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select a category</option>
                  <option value="Restaurant">Restaurant</option>
                  <option value="Cafe">Cafe</option>
                  <option value="Bakery">Bakery</option>
                  <option value="Bar">Bar</option>
                  <option value="Food Truck">Food Truck</option>
                  <option value="Dessert Shop">Dessert Shop</option>
                  <option value="Catering">Catering</option>
                  <option value="Brewery">Brewery</option>
                  <option value="Winery">Winery</option>
                  <option value="Other Food & Drink">Other Food & Drink</option>
                </select>
                <p className="font-lora text-xs text-gray-500 mt-1">
                  Choose the most specific category that describes your food business
                </p>
              </div>
            </div>

            {/* Location Information */}
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                <MapPin className="w-5 h-5 mr-2" />
                Location Information
              </h2>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Business Address *
                </label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  onBlur={handleAddressBlur}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Full street address"
                />
                
                {/* Geocoding Status */}
                {isGeocodingAddress && (
                  <div className="mt-2 flex items-center text-blue-600">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                    <span className="text-sm">Verifying address location...</span>
                  </div>
                )}
                
                {geocodingError && (
                  <div className="mt-2 text-red-600 text-sm">
                    ⚠️ {geocodingError}
                  </div>
                )}
                
                {!isGeocodingAddress && !geocodingError && formData.address && (
                  <div className="mt-2 text-green-600 text-sm">
                    ✅ Address location verified
                  </div>
                )}
              </div>

              {/* City and State Inputs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    City *
                  </label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., New York"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    State/Area *
                  </label>
                  <input
                    type="text"
                    name="state"
                    value={formData.state}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., NY"
                  />
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                <Phone className="w-5 h-5 mr-2" />
                Contact Information
              </h2>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  name="phone_number"
                  value={formData.phone_number}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="(555) 123-4567"
                />
                <p className="font-lora text-xs text-gray-500 mt-1">
                  Helps customers contact you directly
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Website URL
                </label>
                <input
                  type="url"
                  name="website_url"
                  value={formData.website_url}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://www.yourbusiness.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Social Media Links
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="url"
                    value={newSocialMedia}
                    onChange={(e) => setNewSocialMedia(e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="https://facebook.com/yourbusiness"
                  />
                  <button
                    type="button"
                    onClick={addSocialMedia}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.social_media.map((url, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                    >
                      {url}
                      <button
                        type="button"
                        onClick={() => removeSocialMedia(url)}
                        className="ml-2 text-blue-600 hover:text-blue-800"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Business Hours */}
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                <Clock className="w-5 h-5 mr-2" />
                Business Hours
              </h2>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Operating Hours
                </label>
                <input
                  type="text"
                  name="hours"
                  value={formData.hours}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Monday - Friday 9AM - 5PM"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Days Closed
                </label>
                <input
                  type="text"
                  name="days_closed"
                  value={formData.days_closed}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Sundays, Holidays"
                />
              </div>
            </div>

            {/* Pricing */}
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                <DollarSign className="w-5 h-5 mr-2" />
                Pricing
              </h2>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Price Range
                </label>
                <select
                  name="price_range"
                  value={formData.price_range}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select price range</option>
                  <option value="$">$ (Budget-friendly)</option>
                  <option value="$$">$$ (Moderate)</option>
                  <option value="$$$">$$$ (Upscale)</option>
                  <option value="$$$$">$$$$ (Luxury)</option>
                </select>
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                <Tag className="w-5 h-5 mr-2" />
                Tags
              </h2>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Add Tags
                </label>
                <p className="font-lora text-xs text-gray-600 mb-2">
                  Add 5-10 relevant keywords that describe your services, atmosphere, and target audience.
                </p>
                <div className="bg-blue-50 rounded-lg p-3 mb-3">
                  <p className="font-poppins text-sm font-semibold text-blue-800 mb-1">
                    Great tag examples:
                  </p>
                  <div className="font-lora text-xs text-blue-700 space-y-1">
                    <p><strong>Atmosphere:</strong> cozy, modern, rustic, upscale, casual, intimate, lively</p>
                    <p><strong>Services:</strong> organic, vegan-friendly, family-owned, locally-sourced, handcrafted</p>
                    <p><strong>Audience:</strong> family-friendly, pet-friendly, date-night, business-casual, kid-friendly</p>
                  </div>
                </div>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., cozy, organic, family-friendly, live-music"
                  />
                  <button
                    type="button"
                    onClick={addTag}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <p className="font-lora text-xs text-gray-500 mb-2">
                  <span className={formData.tags.length >= 5 ? 'text-green-600' : 'text-gray-500'}>
                    {formData.tags.length} tags added
                  </span>
                  {formData.tags.length < 5 && ' - Add at least 5 tags for better search visibility'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {formData.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="ml-2 text-gray-600 hover:text-gray-800"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Images */}
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">Images</h2>
              
              {/* Cover Image */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cover Image
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                  {coverImage ? (
                    <div className="relative">
                      <img
                        src={coverImage.preview}
                        alt="Cover"
                        className="w-full h-48 object-cover rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage('cover')}
                        className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="text-center">
                      <Upload className="mx-auto h-12 w-12 text-gray-400" />
                      <div className="mt-4">
                        <label className="cursor-pointer">
                          <span className="mt-2 block text-sm font-medium text-gray-900">
                            Upload cover image
                          </span>
                          <input
                            type="file"
                            className="sr-only"
                            accept="image/*"
                            onChange={(e) => handleImageUpload(e, 'cover')}
                          />
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Saving...' : (isEditMode ? 'Update Business' : 'Add Business')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}