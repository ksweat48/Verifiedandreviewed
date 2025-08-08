import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { BusinessService } from '../services/businessService';
import { OfferingService } from '../services/offeringService';
import { UserService } from '../services/userService';
import type { User } from '../types/user';

interface OfferingData {
  id: string; // Temporary ID for form management
  title: string;
  description: string;
  tags: string[];
  price_cents: number | null;
  currency: string;
  images: Array<{
    file: File;
    preview: string;
    uploading: boolean;
    uploaded: boolean;
    approved?: boolean;
    imageId?: string;
  }>;
}

const AddBusinessPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editBusinessId = searchParams.get('edit');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Business form data
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    location: '',
    category: '',
    description: '',
    short_description: '',
    hours: '',
    days_closed: '',
    phone_number: '',
    website_url: '',
    social_media: [''],
    price_range: '',
    service_area: '',
    tags: [''],
    business_type: 'product' as 'product' | 'service' | 'hybrid',
    primary_offering: 'general',
    is_mobile_business: false,
    is_virtual: false
  });

  // Offerings data
  const [offerings, setOfferings] = useState<OfferingData[]>([
    {
      id: 'offering-1',
      title: '',
      description: '',
      tags: [],
      price_cents: null,
      currency: 'USD',
      images: []
    }
  ]);

  const [activeOfferingTab, setActiveOfferingTab] = useState(0);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await UserService.getCurrentUser();
        setUser(userData);
      } catch (err) {
        setError('Please log in to add a business');
      }
    };

    fetchUser();
  }, []);

  // Load business data if editing
  useEffect(() => {
    if (editBusinessId && user) {
      loadBusinessForEdit(editBusinessId);
    }
  }, [editBusinessId, user]);

  const loadBusinessForEdit = async (businessId: string) => {
    try {
      const business = await BusinessService.getBusinessById(businessId);
      if (business) {
        setFormData({
          name: business.name,
          address: business.address || '',
          location: business.location || '',
          category: business.category || '',
          description: business.description || '',
          short_description: business.short_description || '',
          hours: business.hours || '',
          days_closed: business.days_closed || '',
          phone_number: business.phone_number || '',
          website_url: business.website_url || '',
          social_media: business.social_media || [''],
          price_range: business.price_range || '',
          service_area: business.service_area || '',
          tags: business.tags || [''],
          business_type: business.business_type || 'product',
          primary_offering: business.primary_offering || 'general',
          is_mobile_business: business.is_mobile_business || false,
          is_virtual: business.is_virtual || false
        });

        // Load existing offerings
        const existingOfferings = await OfferingService.getBusinessOfferings(businessId);
        if (existingOfferings.length > 0) {
          const formattedOfferings = await Promise.all(
            existingOfferings.map(async (offering) => {
              const images = await OfferingService.getOfferingImages(offering.id, false);
              return {
                id: offering.id,
                title: offering.title,
                description: offering.description || '',
                tags: offering.tags || [],
                price_cents: offering.price_cents,
                currency: offering.currency || 'USD',
                images: images.map(img => ({
                  file: null as any,
                  preview: img.url,
                  uploading: false,
                  uploaded: true,
                  approved: img.approved,
                  imageId: img.id
                }))
              };
            })
          );
          setOfferings(formattedOfferings);
        }
      }
    } catch (err) {
      setError('Failed to load business data');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleArrayInputChange = (field: 'tags' | 'social_media', index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].map((item, i) => i === index ? value : item)
    }));
  };

  const addArrayField = (field: 'tags' | 'social_media') => {
    setFormData(prev => ({
      ...prev,
      [field]: [...prev[field], '']
    }));
  };

  const removeArrayField = (field: 'tags' | 'social_media', index: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index)
    }));
  };

  // Offering management functions
  const addOffering = () => {
    const newOffering: OfferingData = {
      id: `offering-${Date.now()}`,
      title: '',
      description: '',
      tags: [],
      price_cents: null,
      currency: 'USD',
      images: []
    };
    setOfferings(prev => [...prev, newOffering]);
    setActiveOfferingTab(offerings.length);
  };

  const removeOffering = (index: number) => {
    if (offerings.length <= 1) return; // Keep at least one offering
    
    setOfferings(prev => prev.filter((_, i) => i !== index));
    if (activeOfferingTab >= offerings.length - 1) {
      setActiveOfferingTab(Math.max(0, offerings.length - 2));
    }
  };

  const updateOffering = (index: number, field: keyof OfferingData, value: any) => {
    setOfferings(prev => prev.map((offering, i) => 
      i === index ? { ...offering, [field]: value } : offering
    ));
  };

  const addOfferingTag = (offeringIndex: number, tag: string) => {
    if (!tag.trim()) return;
    
    setOfferings(prev => prev.map((offering, i) => 
      i === offeringIndex 
        ? { ...offering, tags: [...offering.tags, tag.trim()] }
        : offering
    ));
  };

  const removeOfferingTag = (offeringIndex: number, tagIndex: number) => {
    setOfferings(prev => prev.map((offering, i) => 
      i === offeringIndex 
        ? { ...offering, tags: offering.tags.filter((_, ti) => ti !== tagIndex) }
        : offering
    ));
  };

  // Image upload functions
  const handleOfferingImageUpload = async (offeringIndex: number, files: FileList) => {
    const offering = offerings[offeringIndex];
    if (!offering || offering.images.length >= 5) return; // Max 5 images per offering

    const remainingSlots = 5 - offering.images.length;
    const filesToProcess = Array.from(files).slice(0, remainingSlots);

    // Add files to state immediately for preview
    const newImages = filesToProcess.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      uploading: true,
      uploaded: false,
      approved: false
    }));

    setOfferings(prev => prev.map((off, i) => 
      i === offeringIndex 
        ? { ...off, images: [...off.images, ...newImages] }
        : off
    ));

    // Upload each file
    for (let i = 0; i < filesToProcess.length; i++) {
      const file = filesToProcess[i];
      const imageIndex = offering.images.length + i;

      try {
        // For new offerings without an ID, we'll upload during form submission
        if (offering.id.startsWith('offering-')) {
          // This is a new offering, mark as ready for upload
          setOfferings(prev => prev.map((off, oi) => 
            oi === offeringIndex 
              ? {
                  ...off,
                  images: off.images.map((img, ii) => 
                    ii === imageIndex 
                      ? { ...img, uploading: false, uploaded: true, approved: true }
                      : img
                  )
                }
              : off
          ));
        } else {
          // This is an existing offering, upload immediately
          const result = await OfferingService.uploadOfferingImage(
            file,
            offering.id,
            'user_upload'
          );

          setOfferings(prev => prev.map((off, oi) => 
            oi === offeringIndex 
              ? {
                  ...off,
                  images: off.images.map((img, ii) => 
                    ii === imageIndex 
                      ? { 
                          ...img, 
                          uploading: false, 
                          uploaded: result.success,
                          approved: result.approved || false,
                          imageId: result.imageId
                        }
                      : img
                  )
                }
              : off
          ));

          if (!result.success) {
            console.error('Image upload failed:', result.error);
          }
        }
      } catch (error) {
        console.error('Error uploading image:', error);
        setOfferings(prev => prev.map((off, oi) => 
          oi === offeringIndex 
            ? {
                ...off,
                images: off.images.map((img, ii) => 
                  ii === imageIndex 
                    ? { ...img, uploading: false, uploaded: false }
                    : img
                )
              }
            : off
        ));
      }
    }
  };

  const removeOfferingImage = (offeringIndex: number, imageIndex: number) => {
    const offering = offerings[offeringIndex];
    const image = offering.images[imageIndex];
    
    // Revoke object URL to prevent memory leaks
    if (image.preview.startsWith('blob:')) {
      URL.revokeObjectURL(image.preview);
    }

    setOfferings(prev => prev.map((off, i) => 
      i === offeringIndex 
        ? { ...off, images: off.images.filter((_, ii) => ii !== imageIndex) }
        : off
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError('Please log in to add a business');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Clean up form data
      const cleanedData = {
        ...formData,
        tags: formData.tags.filter(tag => tag.trim() !== ''),
        social_media: formData.social_media.filter(url => url.trim() !== ''),
        price_cents: null, // Remove from business data
        currency: undefined // Remove from business data
      };

      let businessId: string;

      if (editBusinessId) {
        // Update existing business
        const updateResult = await BusinessService.updateBusiness(editBusinessId, cleanedData);
        if (!updateResult.success) {
          throw new Error(updateResult.error || 'Failed to update business');
        }
        businessId = editBusinessId;
        setSuccess('Business updated successfully!');
      } else {
        // Create new business
        const createResult = await BusinessService.createBusiness(cleanedData, user.id);
        if (!createResult.success || !createResult.businessId) {
          throw new Error(createResult.error || 'Failed to create business');
        }
        businessId = createResult.businessId;
        setSuccess('Business created successfully!');
      }

      // Process offerings
      for (const offering of offerings) {
        if (!offering.title.trim()) continue; // Skip empty offerings

        try {
          let offeringId: string;

          if (offering.id.startsWith('offering-')) {
            // Create new offering
            const offeringResult = await OfferingService.createOffering({
              business_id: businessId,
              title: offering.title,
              description: offering.description || undefined,
              tags: offering.tags.length > 0 ? offering.tags : undefined,
              price_cents: offering.price_cents || undefined,
              currency: offering.currency
            });

            if (!offeringResult.success || !offeringResult.offeringId) {
              console.error('Failed to create offering:', offeringResult.error);
              continue;
            }

            offeringId = offeringResult.offeringId;
          } else {
            // Update existing offering
            const updateResult = await OfferingService.updateOffering(offering.id, {
              title: offering.title,
              description: offering.description || undefined,
              tags: offering.tags.length > 0 ? offering.tags : undefined,
              price_cents: offering.price_cents || undefined,
              currency: offering.currency
            });

            if (!updateResult.success) {
              console.error('Failed to update offering:', updateResult.error);
              continue;
            }

            offeringId = offering.id;
          }

          // Upload images for new offerings
          if (offering.id.startsWith('offering-')) {
            for (const image of offering.images) {
              if (image.file && !image.uploaded) {
                try {
                  const uploadResult = await OfferingService.uploadOfferingImage(
                    image.file,
                    offeringId,
                    'user_upload'
                  );

                  if (!uploadResult.success) {
                    console.error('Failed to upload offering image:', uploadResult.error);
                  }
                } catch (uploadError) {
                  console.error('Error uploading offering image:', uploadError);
                }
              }
            }
          }
        } catch (offeringError) {
          console.error('Error processing offering:', offeringError);
        }
      }

      // Redirect to dashboard after successful submission
      setTimeout(() => {
        navigate('/dashboard?tab=businesses');
      }, 2000);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const businessTypes = [
    { value: 'product', label: 'Product Business', description: 'Sells physical items, food, beverages' },
    { value: 'service', label: 'Service Business', description: 'Provides services, consultations, treatments' },
    { value: 'hybrid', label: 'Hybrid Business', description: 'Combination of products and services' }
  ];

  const primaryOfferings = [
    { value: 'general', label: 'General' },
    { value: 'food_beverage', label: 'Food & Beverage' },
    { value: 'retail', label: 'Retail & Shopping' },
    { value: 'wellness', label: 'Health & Wellness' },
    { value: 'professional', label: 'Professional Services' },
    { value: 'entertainment', label: 'Entertainment & Recreation' }
  ];

  if (!user) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-cinzel text-2xl font-bold text-neutral-900 mb-4">
            Please Log In
          </h1>
          <p className="font-lora text-neutral-600 mb-6">
            You need to be logged in to add a business.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="font-poppins bg-primary-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-600 transition-colors duration-200"
          >
            Log In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-cinzel text-3xl font-bold text-neutral-900">
                {editBusinessId ? 'Edit Business' : 'Add Your Business'}
              </h1>
              <p className="font-lora text-neutral-600 mt-2">
                {editBusinessId 
                  ? 'Update your business information and offerings'
                  : 'Get your business verified and reviewed by our community'
                }
              </p>
            </div>
            <button
              onClick={() => navigate('/dashboard?tab=businesses')}
              className="font-poppins text-neutral-600 hover:text-neutral-900 transition-colors duration-200"
            >
              <Icons.ArrowLeft className="h-5 w-5 mr-2 inline" />
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>

      {/* Main Form */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Error/Success Messages */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center">
                <Icons.AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                <p className="font-lora text-red-700">{error}</p>
              </div>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center">
                <Icons.CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                <p className="font-lora text-green-700">{success}</p>
              </div>
            </div>
          )}

          {/* Business Information Section */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-200">
            <h2 className="font-poppins text-xl font-semibold text-neutral-900 mb-6 flex items-center">
              <Icons.Building className="h-5 w-5 mr-2 text-primary-500" />
              Business Information
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="font-poppins text-sm font-medium text-neutral-700 block mb-2">
                  Business Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-3 border border-neutral-200 rounded-lg font-lora focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Enter your business name"
                />
              </div>

              <div>
                <label className="font-poppins text-sm font-medium text-neutral-700 block mb-2">
                  Category *
                </label>
                <input
                  type="text"
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-3 border border-neutral-200 rounded-lg font-lora focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="e.g., Restaurant, Cafe, Spa, Retail"
                />
              </div>

              <div className="md:col-span-2">
                <label className="font-poppins text-sm font-medium text-neutral-700 block mb-2">
                  Business Type *
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {businessTypes.map((type) => (
                    <label key={type.value} className="relative">
                      <input
                        type="radio"
                        name="business_type"
                        value={type.value}
                        checked={formData.business_type === type.value}
                        onChange={handleInputChange}
                        className="sr-only"
                      />
                      <div className={`border-2 rounded-lg p-4 cursor-pointer transition-all duration-200 ${
                        formData.business_type === type.value
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-neutral-200 hover:border-primary-300'
                      }`}>
                        <div className="font-poppins font-semibold text-neutral-900 mb-1">
                          {type.label}
                        </div>
                        <div className="font-lora text-sm text-neutral-600">
                          {type.description}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-poppins text-sm font-medium text-neutral-700 block mb-2">
                  Primary Offering
                </label>
                <select
                  name="primary_offering"
                  value={formData.primary_offering}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-neutral-200 rounded-lg font-lora focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  {primaryOfferings.map((offering) => (
                    <option key={offering.value} value={offering.value}>
                      {offering.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-poppins text-sm font-medium text-neutral-700 block mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  name="phone_number"
                  value={formData.phone_number}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-neutral-200 rounded-lg font-lora focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="(555) 123-4567"
                />
              </div>

              <div className="md:col-span-2">
                <label className="font-poppins text-sm font-medium text-neutral-700 block mb-2">
                  Address *
                </label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-3 border border-neutral-200 rounded-lg font-lora focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="123 Main St, City, State 12345"
                />
              </div>

              <div className="md:col-span-2">
                <label className="font-poppins text-sm font-medium text-neutral-700 block mb-2">
                  Short Description
                </label>
                <textarea
                  name="short_description"
                  value={formData.short_description}
                  onChange={handleInputChange}
                  rows={2}
                  className="w-full px-4 py-3 border border-neutral-200 rounded-lg font-lora focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Brief description of your business (1-2 sentences)"
                />
              </div>

              <div className="md:col-span-2">
                <label className="font-poppins text-sm font-medium text-neutral-700 block mb-2">
                  Full Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={4}
                  className="w-full px-4 py-3 border border-neutral-200 rounded-lg font-lora focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Detailed description of your business, services, and what makes you special"
                />
              </div>

              {/* Business Type Specific Fields */}
              <div className="md:col-span-2">
                <div className="flex items-center space-x-6">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      name="is_mobile_business"
                      checked={formData.is_mobile_business}
                      onChange={handleInputChange}
                      className="rounded border-neutral-300 text-primary-500 focus:ring-primary-500 mr-2"
                    />
                    <span className="font-poppins text-sm text-neutral-700">Mobile Business (We come to you)</span>
                  </label>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      name="is_virtual"
                      checked={formData.is_virtual}
                      onChange={handleInputChange}
                      className="rounded border-neutral-300 text-primary-500 focus:ring-primary-500 mr-2"
                    />
                    <span className="font-poppins text-sm text-neutral-700">Virtual Business (Online only)</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="font-poppins text-sm font-medium text-neutral-700 block mb-2">
                  Website URL
                </label>
                <input
                  type="url"
                  name="website_url"
                  value={formData.website_url}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-neutral-200 rounded-lg font-lora focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="https://yourwebsite.com"
                />
              </div>

              <div>
                <label className="font-poppins text-sm font-medium text-neutral-700 block mb-2">
                  Price Range
                </label>
                <select
                  name="price_range"
                  value={formData.price_range}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-neutral-200 rounded-lg font-lora focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">Select price range</option>
                  <option value="$">$ - Budget friendly</option>
                  <option value="$$">$$ - Moderate</option>
                  <option value="$$$">$$$ - Expensive</option>
                  <option value="$$$$">$$$$ - Very expensive</option>
                </select>
              </div>

              <div>
                <label className="font-poppins text-sm font-medium text-neutral-700 block mb-2">
                  Hours
                </label>
                <textarea
                  name="hours"
                  value={formData.hours}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-4 py-3 border border-neutral-200 rounded-lg font-lora focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Mon-Fri: 9AM-6PM&#10;Sat: 10AM-4PM&#10;Sun: Closed"
                />
              </div>

              <div>
                <label className="font-poppins text-sm font-medium text-neutral-700 block mb-2">
                  Days Closed
                </label>
                <input
                  type="text"
                  name="days_closed"
                  value={formData.days_closed}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-neutral-200 rounded-lg font-lora focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="e.g., Sundays, Holidays"
                />
              </div>

              {(formData.is_mobile_business || formData.is_virtual) && (
                <div className="md:col-span-2">
                  <label className="font-poppins text-sm font-medium text-neutral-700 block mb-2">
                    Service Area
                  </label>
                  <input
                    type="text"
                    name="service_area"
                    value={formData.service_area}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-neutral-200 rounded-lg font-lora focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="e.g., San Francisco Bay Area, Nationwide, etc."
                  />
                </div>
              )}
            </div>

            {/* Tags Section */}
            <div className="mt-6">
              <label className="font-poppins text-sm font-medium text-neutral-700 block mb-2">
                Tags & Features
              </label>
              <div className="space-y-2">
                {formData.tags.map((tag, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={tag}
                      onChange={(e) => handleArrayInputChange('tags', index, e.target.value)}
                      className="flex-1 px-4 py-2 border border-neutral-200 rounded-lg font-lora focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="e.g., Vegan Options, Drive-thru, Free WiFi"
                    />
                    {formData.tags.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeArrayField('tags', index)}
                        className="p-2 text-red-500 hover:text-red-700 transition-colors duration-200"
                      >
                        <Icons.X className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addArrayField('tags')}
                  className="font-poppins text-primary-500 hover:text-primary-600 transition-colors duration-200 flex items-center"
                >
                  <Icons.Plus className="h-4 w-4 mr-1" />
                  Add Tag
                </button>
              </div>
            </div>

            {/* Social Media Section */}
            <div className="mt-6">
              <label className="font-poppins text-sm font-medium text-neutral-700 block mb-2">
                Social Media Links
              </label>
              <div className="space-y-2">
                {formData.social_media.map((url, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => handleArrayInputChange('social_media', index, e.target.value)}
                      className="flex-1 px-4 py-2 border border-neutral-200 rounded-lg font-lora focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="https://facebook.com/yourbusiness"
                    />
                    {formData.social_media.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeArrayField('social_media', index)}
                        className="p-2 text-red-500 hover:text-red-700 transition-colors duration-200"
                      >
                        <Icons.X className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addArrayField('social_media')}
                  className="font-poppins text-primary-500 hover:text-primary-600 transition-colors duration-200 flex items-center"
                >
                  <Icons.Plus className="h-4 w-4 mr-1" />
                  Add Social Media Link
                </button>
              </div>
            </div>
          </div>

          {/* Offerings Section */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-poppins text-xl font-semibold text-neutral-900 flex items-center">
                <Icons.Package className="h-5 w-5 mr-2 text-primary-500" />
                Offerings & Menu Items
              </h2>
              <button
                type="button"
                onClick={addOffering}
                className="font-poppins bg-primary-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-primary-600 transition-colors duration-200 flex items-center"
              >
                <Icons.Plus className="h-4 w-4 mr-2" />
                Add Offering
              </button>
            </div>

            {/* Offering Tabs */}
            <div className="border-b border-neutral-200 mb-6">
              <div className="flex overflow-x-auto">
                {offerings.map((offering, index) => (
                  <button
                    key={offering.id}
                    type="button"
                    onClick={() => setActiveOfferingTab(index)}
                    className={`flex-shrink-0 px-4 py-2 font-poppins font-medium transition-colors duration-200 ${
                      activeOfferingTab === index
                        ? 'text-primary-500 border-b-2 border-primary-500'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    {offering.title || `Offering ${index + 1}`}
                    {offerings.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeOffering(index);
                        }}
                        className="ml-2 text-red-500 hover:text-red-700"
                      >
                        <Icons.X className="h-3 w-3" />
                      </button>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Active Offering Form */}
            {offerings[activeOfferingTab] && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="font-poppins text-sm font-medium text-neutral-700 block mb-2">
                      Offering Title *
                    </label>
                    <input
                      type="text"
                      value={offerings[activeOfferingTab].title}
                      onChange={(e) => updateOffering(activeOfferingTab, 'title', e.target.value)}
                      required
                      className="w-full px-4 py-3 border border-neutral-200 rounded-lg font-lora focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="e.g., Spicy Ramen Bowl, Deep Tissue Massage, Organic Coffee"
                    />
                  </div>

                  <div>
                    <label className="font-poppins text-sm font-medium text-neutral-700 block mb-2">
                      Price
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={offerings[activeOfferingTab].currency}
                        onChange={(e) => updateOffering(activeOfferingTab, 'currency', e.target.value)}
                        className="px-3 py-3 border border-neutral-200 rounded-lg font-lora focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      >
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="GBP">GBP</option>
                      </select>
                      <input
                        type="number"
                        value={offerings[activeOfferingTab].price_cents ? (offerings[activeOfferingTab].price_cents! / 100).toFixed(2) : ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          const cents = value ? Math.round(parseFloat(value) * 100) : null;
                          updateOffering(activeOfferingTab, 'price_cents', cents);
                        }}
                        step="0.01"
                        min="0"
                        className="flex-1 px-4 py-3 border border-neutral-200 rounded-lg font-lora focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="font-poppins text-sm font-medium text-neutral-700 block mb-2">
                      Description
                    </label>
                    <textarea
                      value={offerings[activeOfferingTab].description}
                      onChange={(e) => updateOffering(activeOfferingTab, 'description', e.target.value)}
                      rows={3}
                      className="w-full px-4 py-3 border border-neutral-200 rounded-lg font-lora focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="Detailed description of this offering, ingredients, features, etc."
                    />
                  </div>
                </div>

                {/* Tags for this offering */}
                <div>
                  <label className="font-poppins text-sm font-medium text-neutral-700 block mb-2">
                    Tags for this offering
                  </label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {offerings[activeOfferingTab].tags.map((tag, tagIndex) => (
                      <span
                        key={tagIndex}
                        className="bg-primary-100 text-primary-700 px-3 py-1 rounded-full text-sm font-poppins flex items-center"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeOfferingTag(activeOfferingTab, tagIndex)}
                          className="ml-2 text-primary-500 hover:text-primary-700"
                        >
                          <Icons.X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Add a tag (e.g., spicy, vegan, gluten-free)"
                      className="flex-1 px-4 py-2 border border-neutral-200 rounded-lg font-lora focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const input = e.target as HTMLInputElement;
                          if (input.value.trim()) {
                            addOfferingTag(activeOfferingTab, input.value.trim());
                            input.value = '';
                          }
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        const input = (e.target as HTMLElement).previousElementSibling as HTMLInputElement;
                        if (input.value.trim()) {
                          addOfferingTag(activeOfferingTab, input.value.trim());
                          input.value = '';
                        }
                      }}
                      className="px-4 py-2 bg-primary-500 text-white rounded-lg font-poppins font-semibold hover:bg-primary-600 transition-colors duration-200"
                    >
                      Add
                    </button>
                  </div>
                </div>

                {/* Image Upload for this offering */}
                <div>
                  <label className="font-poppins text-sm font-medium text-neutral-700 block mb-2">
                    Images for this offering (up to 5)
                  </label>
                  
                  {/* Image Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                    {offerings[activeOfferingTab].images.map((image, imageIndex) => (
                      <div key={imageIndex} className="relative aspect-square">
                        <img
                          src={image.preview}
                          alt={`Offering image ${imageIndex + 1}`}
                          className="w-full h-full object-cover rounded-lg border border-neutral-200"
                        />
                        
                        {/* Upload Status Overlay */}
                        {image.uploading && (
                          <div className="absolute inset-0 bg-black bg-opacity-50 rounded-lg flex items-center justify-center">
                            <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent"></div>
                          </div>
                        )}
                        
                        {/* Approval Status Badge */}
                        {image.uploaded && (
                          <div className={`absolute top-2 left-2 px-2 py-1 rounded-full text-xs font-poppins font-bold ${
                            image.approved 
                              ? 'bg-green-500 text-white' 
                              : 'bg-yellow-500 text-white'
                          }`}>
                            {image.approved ? 'APPROVED' : 'PENDING'}
                          </div>
                        )}
                        
                        {/* Remove Button */}
                        <button
                          type="button"
                          onClick={() => removeOfferingImage(activeOfferingTab, imageIndex)}
                          className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition-colors duration-200"
                        >
                          <Icons.X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    
                    {/* Upload Button */}
                    {offerings[activeOfferingTab].images.length < 5 && (
                      <label className="aspect-square border-2 border-dashed border-neutral-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary-500 transition-colors duration-200">
                        <Icons.Camera className="h-8 w-8 text-neutral-400 mb-2" />
                        <span className="font-poppins text-sm text-neutral-600 text-center">
                          Add Image
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={(e) => {
                            if (e.target.files) {
                              handleOfferingImageUpload(activeOfferingTab, e.target.files);
                            }
                          }}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                  
                  <p className="font-lora text-xs text-neutral-500">
                    Upload high-quality images of your offering. 
                    {import.meta.env.VITE_AUTO_APPROVE_OFFERINGS === 'true' 
                      ? ' Images are automatically approved after safety checks.'
                      : ' Images require admin approval before going live.'
                    }
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => navigate('/dashboard?tab=businesses')}
              className="flex-1 font-poppins border border-neutral-200 text-neutral-700 py-3 px-6 rounded-lg font-semibold hover:bg-neutral-50 transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`flex-1 font-poppins py-3 px-6 rounded-lg font-semibold transition-colors duration-200 ${
                loading
                  ? 'bg-neutral-300 text-neutral-600 cursor-not-allowed'
                  : 'bg-primary-500 text-white hover:bg-primary-600'
              }`}
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <Icons.Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  {editBusinessId ? 'Updating...' : 'Creating...'}
                </span>
              ) : (
                editBusinessId ? 'Update Business' : 'Create Business'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddBusinessPage;