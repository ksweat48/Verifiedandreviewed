import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Upload, X, Plus, MapPin, Clock, Phone, Globe, DollarSign, Trash2 } from 'lucide-react';
import { BusinessService } from '../services/businessService';
import { OfferingService } from '../services/offeringService';
import { useAuth } from '../hooks/useAuth';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';
import { supabase } from '../services/supabaseClient';
import { resizeImage } from '../utils/imageResizer';

interface UploadedImage {
  file: File | null;
  preview: string;
}

interface OfferingData {
  id?: string;
  name: string;
  short_description: string;
  image_file: File | null;
  image_url: string;
  price: number;
  currency: string;
}

interface FormData {
  name: string;
  address: string;
  city: string;
  state: string;
  category: string;
  description: string;
  short_description: string;
  hours: string;
  days_closed: string;
  phone_number: string;
  website_url: string;
  social_media: string[];
  offerings: OfferingData[];
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
    description: '',
    short_description: '',
    hours: '',
    days_closed: '',
    phone_number: '',
    website_url: '',
    social_media: [],
    offerings: [],
  });

  const [coverImage, setCoverImage] = useState<UploadedImage | null>(null);
  const [newSocialMedia, setNewSocialMedia] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeocodingAddress, setIsGeocodingAddress] = useState(false);
  const [geocodingError, setGeocodingError] = useState<string>('');

  // New offering state
  const [newOffering, setNewOffering] = useState<OfferingData>({
    name: '',
    short_description: '',
    image_file: null,
    image_url: '',
    price: 0,
    currency: 'USD',
  });
  const [newOfferingImagePreview, setNewOfferingImagePreview] = useState<string | null>(null);

  // Helper function to upload image to Supabase Storage
  const uploadImageToSupabase = async (file: File, folder: string): Promise<string | null> => {
    try {
      if (!user) {
        throw new Error('User not authenticated');
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
      const filePath = `${user.id}/${folder}/${fileName}`;

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

            // Fetch existing offerings
            const existingOfferings = await OfferingService.getBusinessOfferings(editBusinessId);
            const formattedOfferings: OfferingData[] = existingOfferings.map(offering => ({
              id: offering.id,
              name: offering.title,
              short_description: offering.description || '',
              image_file: null,
              image_url: '', // Will need to fetch from offering_images table
              price: (offering.price_cents || 0) / 100,
              currency: offering.currency || 'USD',
            }));

            setFormData({
              name: business.name || '',
              address: business.address || '',
              city: initialCity,
              state: initialState,
              category: business.category || '',
              description: business.description || '',
              short_description: business.short_description || '',
              hours: business.hours || '',
              days_closed: business.days_closed || '',
              phone_number: business.phone_number || '',
              website_url: business.website_url || '',
              social_media: business.social_media || [],
              offerings: formattedOfferings,
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

  // Offering management functions
  const handleNewOfferingInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewOffering(prev => ({
      ...prev,
      [name]: name === 'price' ? parseFloat(value) || 0 : value
    }));
  };

  const handleNewOfferingImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      const resizedFile = await resizeImage(files[0], 800, 600, 0.8);
      const previewUrl = URL.createObjectURL(resizedFile);
      setNewOffering(prev => ({
        ...prev,
        image_file: resizedFile,
        image_url: previewUrl
      }));
      setNewOfferingImagePreview(previewUrl);
    } catch (error) {
      console.error('Error processing offering image:', error);
      alert('Failed to process offering image. Please try a different file or a smaller image.');
    }
  };

  const addOffering = () => {
    if (!newOffering.name.trim() || !newOffering.short_description.trim() || newOffering.price <= 0) {
      alert('Please fill in all required fields for the offering (Name, Short Description, Price).');
      return;
    }

    setFormData(prev => ({
      ...prev,
      offerings: [...prev.offerings, { ...newOffering }]
    }));
    
    // Reset new offering form
    setNewOffering({
      name: '',
      short_description: '',
      image_file: null,
      image_url: '',
      price: 0,
      currency: 'USD',
    });
    setNewOfferingImagePreview(null);
  };

  const removeOffering = (indexToRemove: number) => {
    setFormData(prev => ({
      ...prev,
      offerings: prev.offerings.filter((_, index) => index !== indexToRemove)
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
          const uploadedUrl = await uploadImageToSupabase(coverImage.file, 'businesses');
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

      let businessId: string;

      if (isEditMode && editBusinessId) {
        console.log('✏️ Updating business with image URLs...');
        await BusinessService.updateBusiness(editBusinessId, businessData);
        businessId = editBusinessId;
      } else {
        console.log('➕ Creating business with image URLs...');
        const result = await BusinessService.createBusiness(businessData, user.id);
        if (!result.success || !result.businessId) {
          throw new Error(result.error || 'Failed to create business');
        }
        businessId = result.businessId;
      }

      // Handle offerings
      console.log('🍽️ Processing offerings...');
      
      // Get existing offerings if in edit mode
      const existingOfferings = isEditMode ? await OfferingService.getBusinessOfferings(businessId) : [];
      
      // Determine which offerings to delete, create, or update
      const offeringsToDelete = existingOfferings.filter(
        existing => !formData.offerings.some(current => current.id === existing.id)
      );
      const offeringsToCreate = formData.offerings.filter(offering => !offering.id);
      const offeringsToUpdate = formData.offerings.filter(offering => offering.id);

      // Delete removed offerings
      for (const offering of offeringsToDelete) {
        console.log('🗑️ Deleting offering:', offering.title);
        // Note: OfferingService.deleteOffering needs to be implemented
      }

      // Create new offerings
      for (const offering of offeringsToCreate) {
        console.log('➕ Creating offering:', offering.name);
        let offeringImageUrl = '';
        
        if (offering.image_file) {
          offeringImageUrl = await uploadImageToSupabase(offering.image_file, 'offerings');
          if (!offeringImageUrl) {
            console.warn(`Failed to upload image for offering: ${offering.name}`);
          }
        }
        
        await OfferingService.createOffering(businessId, {
          title: offering.name,
          description: offering.short_description,
          price_cents: Math.round(offering.price * 100),
          currency: offering.currency,
          service_type: 'onsite',
          status: 'active'
        });
      }

      // Update existing offerings
      for (const offering of offeringsToUpdate) {
        console.log('✏️ Updating offering:', offering.name);
        let offeringImageUrl = offering.image_url;
        
        if (offering.image_file) {
          const uploadedUrl = await uploadImageToSupabase(offering.image_file, 'offerings');
          if (uploadedUrl) {
            offeringImageUrl = uploadedUrl;
          }
        }
        
        // Note: OfferingService.updateOffering needs to be implemented
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

            {/* Create Your Menu Offerings */}
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 uppercase tracking-wide">
                  Create Your Menu Offerings
                </h2>
                <p className="font-lora text-gray-600 mt-2">
                  Upload at least 10 menu items for the best results.
                </p>
                <p className="font-lora text-gray-600">
                  The more offerings you add, the easier it is for customers to find you.
                </p>
              </div>

              <div className="bg-gray-50 p-6 rounded-lg space-y-4">
                <div>
                  <input
                    type="text"
                    name="name"
                    value={newOffering.name}
                    onChange={handleNewOfferingInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-200 placeholder-gray-500"
                    placeholder="NAME"
                  />
                </div>
                
                <div>
                  <textarea
                    name="short_description"
                    value={newOffering.short_description}
                    onChange={handleNewOfferingInputChange}
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-200 placeholder-gray-500"
                    placeholder="SHORT DESCRIPTION"
                  />
                </div>
                
                <div>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center bg-gray-200">
                    {newOfferingImagePreview ? (
                      <div className="relative w-32 h-32 mx-auto">
                        <img 
                          src={newOfferingImagePreview} 
                          alt="Offering Preview" 
                          className="w-full h-full object-cover rounded-lg" 
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setNewOffering(prev => ({ ...prev, image_file: null, image_url: '' }));
                            setNewOfferingImagePreview(null);
                          }}
                          className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="cursor-pointer">
                        <div className="text-gray-500">
                          <Upload className="mx-auto h-8 w-8 mb-2" />
                          <span className="block text-sm font-medium">UPLOAD IMAGE</span>
                        </div>
                        <input
                          type="file"
                          className="sr-only"
                          accept="image/*"
                          onChange={handleNewOfferingImageUpload}
                        />
                      </label>
                    )}
                  </div>
                </div>
                
                <div>
                  <input
                    type="number"
                    name="price"
                    value={newOffering.price === 0 ? '' : newOffering.price}
                    onChange={handleNewOfferingInputChange}
                    min="0"
                    step="0.01"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-200 placeholder-gray-500"
                    placeholder="PRICE"
                  />
                </div>
                
                <button
                  type="button"
                  onClick={addOffering}
                  className="w-full px-4 py-3 bg-gray-400 text-white rounded-lg hover:bg-gray-500 font-medium uppercase tracking-wide"
                >
                  Add Offering
                </button>
              </div>
            </div>

            {/* Your Offerings List */}
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900 uppercase tracking-wide">
                Your Offerings {formData.offerings.length}
              </h2>
              
              {formData.offerings.length === 0 ? (
                <div className="text-center py-12">
                  <p className="font-lora text-gray-600 text-lg">
                    You currently have 0 offerings
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {formData.offerings.map((offering, index) => (
                    <div key={offering.id || index} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex items-center space-x-4">
                      {offering.image_url && (
                        <img 
                          src={offering.image_url} 
                          alt={offering.name} 
                          className="w-16 h-16 object-cover rounded-lg flex-shrink-0" 
                        />
                      )}
                      <div className="flex-1">
                        <h3 className="font-poppins font-semibold text-gray-900">{offering.name}</h3>
                        <p className="font-lora text-sm text-gray-600">{offering.short_description}</p>
                        <p className="font-poppins text-sm font-medium text-gray-800">
                          ${offering.price.toFixed(2)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeOffering(index)}
                        className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-full transition-colors duration-200"
                        title="Remove offering"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
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