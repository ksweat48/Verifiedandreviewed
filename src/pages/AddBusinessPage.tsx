import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Upload, X, Plus, MapPin, Clock, Phone, Globe, DollarSign, Tag } from 'lucide-react';
import { BusinessService } from '../services/businessService';
import { useAuth } from '../hooks/useAuth';

interface UploadedImage {
  file: File | null;
  preview: string;
}

interface FormData {
  name: string;
  address: string;
  location: string;
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
  service_area: string;
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
    location: '',
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
    service_area: ''
  });

  const [coverImage, setCoverImage] = useState<UploadedImage | null>(null);
  const [galleryImages, setGalleryImages] = useState<UploadedImage[]>([]);
  const [newTag, setNewTag] = useState('');
  const [newSocialMedia, setNewSocialMedia] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeocodingAddress, setIsGeocodingAddress] = useState(false);
  const [geocodingError, setGeocodingError] = useState<string>('');

  // Fetch business data if in edit mode
  useEffect(() => {
    if (isEditMode && editBusinessId) {
      const fetchBusinessData = async () => {
        try {
          const business = await BusinessService.getBusinessById(editBusinessId);
          if (business) {
            setFormData({
              name: business.name || '',
              address: business.address || '',
              location: business.location || '',
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
              service_area: business.service_area || ''
            });

            // Set cover image if exists
            if (business.image_url) {
              setCoverImage({
                file: null,
                preview: business.image_url
              });
            }

            // Set gallery images if exist
            if (business.gallery_urls && business.gallery_urls.length > 0) {
              const galleryImgs = business.gallery_urls.map(url => ({
                file: null,
                preview: url
              }));
              setGalleryImages(galleryImgs);
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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'cover' | 'gallery') => {
    const files = e.target.files;
    if (!files) return;

    if (type === 'cover' && files[0]) {
      const file = files[0];
      setCoverImage({
        file,
        preview: URL.createObjectURL(file)
      });
    } else if (type === 'gallery') {
      const newImages: UploadedImage[] = Array.from(files).map(file => ({
        file,
        preview: URL.createObjectURL(file)
      }));
      setGalleryImages(prev => [...prev, ...newImages]);
    }
  };

  const removeImage = (index: number, type: 'cover' | 'gallery') => {
    if (type === 'cover') {
      if (coverImage?.preview && coverImage.file) {
        URL.revokeObjectURL(coverImage.preview);
      }
      setCoverImage(null);
    } else {
      const imageToRemove = galleryImages[index];
      if (imageToRemove?.preview && imageToRemove.file) {
        URL.revokeObjectURL(imageToRemove.preview);
      }
      setGalleryImages(prev => prev.filter((_, i) => i !== index));
    }
  };

  // Geocode address when user finishes typing
  const handleAddressBlur = async () => {
    if (!formData.address.trim()) return;
    
    setIsGeocodingAddress(true);
    setGeocodingError('');
    
    try {
      const response = await fetch('/.netlify/functions/geocode-address', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ address: formData.address })
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
      let galleryUrls: string[] = [];

      // Handle cover image upload
      if (coverImage) {
        if (coverImage.file) {
          // For now, use a placeholder URL since uploadImage method doesn't exist
          coverImageUrl = 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400';
        } else {
          // Existing image URL
          coverImageUrl = coverImage.preview;
        }
      }

      // Handle gallery images upload
      for (const image of galleryImages) {
        if (image.file) {
          // For now, use a placeholder URL since uploadImage method doesn't exist
          galleryUrls.push('https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400');
        } else {
          // Existing image URL
          galleryUrls.push(image.preview);
        }
      }

      const businessData = {
        ...formData,
        image_url: coverImageUrl,
        gallery_urls: galleryUrls,
      };

      if (isEditMode && editBusinessId) {
        await BusinessService.updateBusiness(editBusinessId, businessData);
      } else {
        await BusinessService.createBusiness(businessData, user.id);
      }

      navigate('/dashboard');
    } catch (error) {
      console.error('Error saving business:', error);
      alert('Error saving business. Please try again.');
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
                  placeholder="Enter your business name"
                />
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
                  placeholder="Brief description of your business"
                  maxLength={100}
                />
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
                  placeholder="Detailed description of your business, services, and what makes you unique"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select a category</option>
                  <option value="Restaurant">Restaurant</option>
                  <option value="Retail">Retail</option>
                  <option value="Service">Service</option>
                  <option value="Health & Wellness">Health & Wellness</option>
                  <option value="Entertainment">Entertainment</option>
                  <option value="Professional">Professional</option>
                  <option value="Other">Other</option>
                </select>
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
                  Address
                </label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  onBlur={handleAddressBlur}
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Location/Area
                </label>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="City, neighborhood, or area"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Service Area
                </label>
                <input
                  type="text"
                  name="service_area"
                  value={formData.service_area}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Areas you serve (e.g., Local, Citywide, Statewide)"
                />
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
                  Phone Number
                </label>
                <input
                  type="tel"
                  name="phone_number"
                  value={formData.phone_number}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="(555) 123-4567"
                />
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
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., organic, family-friendly, outdoor seating"
                  />
                  <button
                    type="button"
                    onClick={addTag}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
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
                        onClick={() => removeImage(0, 'cover')}
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

              {/* Gallery Images */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Gallery Images
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                  <div className="text-center mb-4">
                    <Upload className="mx-auto h-12 w-12 text-gray-400" />
                    <div className="mt-4">
                      <label className="cursor-pointer">
                        <span className="mt-2 block text-sm font-medium text-gray-900">
                          Upload gallery images
                        </span>
                        <input
                          type="file"
                          className="sr-only"
                          accept="image/*"
                          multiple
                          onChange={(e) => handleImageUpload(e, 'gallery')}
                        />
                      </label>
                    </div>
                  </div>
                  
                  {galleryImages.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                      {galleryImages.map((image, index) => (
                        <div key={index} className="relative">
                          <img
                            src={image.preview}
                            alt={`Gallery ${index + 1}`}
                            className="w-full h-32 object-cover rounded-lg"
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(index, 'gallery')}
                            className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
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