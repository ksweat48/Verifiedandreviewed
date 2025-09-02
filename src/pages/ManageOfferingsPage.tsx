import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Upload, X, Plus, ArrowLeft, Trash2, Save, Camera, DollarSign, Edit } from 'lucide-react';
import { OfferingService } from '../services/offeringService';
import { BusinessService } from '../services/businessService';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../services/supabaseClient';
import { resizeImage } from '../utils/imageResizer';
import { showError, showSuccess } from '../utils/toast';

interface OfferingData {
  id?: string;
  name: string;
  short_description: string;
  image_file: File | null;
  image_url: string;
  price: number;
  currency: string;
}

interface Business {
  id: string;
  name: string;
  image_url?: string;
  category?: string;
}

export default function ManageOfferingsPage() {
  console.log('ManageOfferingsPage component rendering...');
  
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const businessId = searchParams.get('businessId');
  const offeringId = searchParams.get('offeringId');
  const isEditMode = !!offeringId;

  const [business, setBusiness] = useState<Business | null>(null);
  const [offerings, setOfferings] = useState<OfferingData[]>([]);
  const [newOfferingFile, setNewOfferingFile] = useState<File | null>(null); // Store current form's File object
  const [newOffering, setNewOffering] = useState<OfferingData>({
    name: '',
    short_description: '',
    image_file: null,
    image_url: '',
    currency: 'USD',
  });
  const [newOfferingImagePreview, setNewOfferingImagePreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>('');
  const [editingOffering, setEditingOffering] = useState<any>(null);

  // Update offerings list when newOffering changes (for real-time preview)
  useEffect(() => {
    if (newOffering.id) {
      // Update the offering in the list for real-time preview
      setOfferings(prev => prev.map(offering => 
        offering.id === newOffering.id ? {
          ...offering,
          name: newOffering.name,
          short_description: newOffering.short_description,
          price: newOffering.price,
          currency: newOffering.currency,
          image_url: newOffering.image_url || offering.image_url
        } : offering
      ));
    }
  }, [newOffering.name, newOffering.short_description, newOffering.price, newOffering.currency, newOffering.image_url, newOffering.id]);

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

  // Load business and offerings data
  useEffect(() => {
    const loadData = async () => {
      console.log('loadData useEffect triggered for businessId:', businessId);
      
      if (!businessId) {
        setError('No business ID provided');
        setIsLoading(false);
        return;
      }

      try {
        // Fetch business details
        const businessData = await BusinessService.getBusinessById(businessId);
        if (!businessData) {
          throw new Error('Business not found');
        }
        setBusiness(businessData);

        // Fetch existing offerings
        const existingOfferings = await OfferingService.getBusinessOfferings(businessId);
        const formattedOfferings: OfferingData[] = existingOfferings.map(offering => ({
          id: offering.id,
          name: offering.title,
          short_description: offering.description || '',
          image_file: null,
          image_url: offering.images?.[0]?.url || '',
          currency: offering.currency || 'USD',
        }));
        setOfferings(formattedOfferings);
        
        // If editing a specific offering, load it into the form
        if (offeringId) {
          const offeringToEdit = await OfferingService.getOfferingById(offeringId);
          if (offeringToEdit) {
            const primaryImage = offeringToEdit.images?.find(img => img.is_primary && img.approved);
            const fallbackImage = offeringToEdit.images?.find(img => img.approved);
            const imageUrl = primaryImage?.url || fallbackImage?.url || '';
            
            setEditingOffering(offeringToEdit);
            setNewOffering({
              id: offeringToEdit.id,
              name: offeringToEdit.title,
              short_description: offeringToEdit.description || '',
              image_file: null,
              image_url: imageUrl,
              price: (offeringToEdit.price_cents || 0) / 100,
              currency: offeringToEdit.currency || 'USD',
            });
            setNewOfferingImagePreview(imageUrl || null);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [businessId, offeringId]);

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
      
      // Store the File object separately
      setNewOfferingFile(resizedFile);
      
      // Update the form state with the preview URL for immediate visual feedback
      setNewOffering(prev => ({
        ...prev,
        image_url: previewUrl
      }));
      
      setNewOfferingImagePreview(previewUrl);
      console.log('🖼️ Image selected - File object stored, preview URL set for immediate feedback');
    } catch (error) {
      console.error('Error processing offering image:', error);
      alert('Failed to process offering image. Please try a different file or a smaller image.');
    }
  };

  const handleSaveOfferingToLocalState = () => {
    if (!newOffering.name.trim() || !newOffering.short_description.trim() || newOffering.price <= 0) {
      showError('Please fill in all required fields for the offering (Name, Short Description, Price).');
      return;
    }

    if (newOffering.id) {
      // Update existing offering
      setOfferings(prev => prev.map(offering => 
        offering.id === newOffering.id ? {
          ...offering,
          name: newOffering.name,
          short_description: newOffering.short_description,
          price: newOffering.price,
          currency: newOffering.currency,
          image_url: newOffering.image_url || offering.image_url
        } : offering
      ));
      console.log('🔄 Updated existing offering in local state - form remains populated for further edits');
    } else {
      // Add new offering
      const offeringKey = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const newOfferingForState = {
        id: offeringKey,
        name: newOffering.name,
        short_description: newOffering.short_description,
        price: newOffering.price,
        currency: newOffering.currency,
        image_file: null,
        image_url: newOffering.image_url
      };
      
      setOfferings(prev => [...prev, newOfferingForState]);
      
      // Clear form only for new offerings
      clearForm();
      console.log('➕ Added new offering to local state and cleared form');
    }
  };
  
  const clearForm = () => {
    // Revoke blob URL if it exists
    if (newOfferingImagePreview && newOfferingImagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(newOfferingImagePreview);
    }
    
    setNewOffering({
      name: '',
      short_description: '',
      image_file: null,
      image_url: '',
      price: 0,
      currency: 'USD',
    });
    setNewOfferingFile(null);
    setNewOfferingImagePreview(null);
    setEditingOffering(null);
    
    // Remove offeringId from URL
    if (offeringId) {
      navigate(`/manage-offerings?businessId=${businessId}`, { replace: true });
    }
    console.log('🧹 Form cleared - all state reset');
  };

  const removeOffering = (indexToRemove: number) => {
    const offeringToRemove = offerings[indexToRemove];
    
    // If we're removing the currently edited offering, clear the form
    if (offeringToRemove?.id === newOffering.id) {
      clearForm();
    }
    
    setOfferings(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleSaveOfferings = async () => {
    console.log('🚀 DEBUG: handleSaveOfferings function called');
    
    if (!businessId) return;

    setIsSaving(true);
    try {
      // Get existing offerings from database
      const existingOfferings = await OfferingService.getBusinessOfferings(businessId);
      
      // Determine which offerings to delete, create, or update
      const offeringsToDelete = existingOfferings.filter(
        existing => !offerings.some(current => current.id === existing.id)
      );
      const offeringsToCreate = offerings.filter(offering => !offering.id);
      const offeringsToUpdate = offerings.filter(offering => offering.id);
      
      console.log('🔍 Offerings categorization:', {
        totalOfferings: offerings.length,
        offeringsToCreate: offeringsToCreate.length,
        offeringsToUpdate: offeringsToUpdate.length,
        offeringsToDelete: offeringsToDelete.length
      });

      // Delete removed offerings
      for (const offering of offeringsToDelete) {
        console.log('🗑️ Deleting offering:', offering.title);
        await OfferingService.deleteOffering(offering.id);
      }

      // Create new offerings
      for (const offering of offeringsToCreate) {
        console.log('➕ Creating offering:', offering.name);
        let finalImageUrl = '';
        
        // Check if this is the currently edited offering with a new file
        if (offering.id === newOffering.id && newOfferingFile) {
          console.log('📤 Uploading new image for offering:', offering.name);
          const uploadedUrl = await uploadImageToSupabase(newOfferingFile, 'offerings');
          if (uploadedUrl) {
            finalImageUrl = uploadedUrl;
            console.log('✅ Image uploaded successfully:', uploadedUrl);
          } else {
            console.warn(`❌ Failed to upload image for offering: ${offering.name}`);
          }
        } else if (offering.image_url && !offering.image_url.startsWith('blob:')) {
          // Use existing permanent URL
          finalImageUrl = offering.image_url;
          console.log('🔗 Using existing image URL:', finalImageUrl);
        }
        
        const result = await OfferingService.createOffering(businessId, {
          title: offering.name,
          description: offering.short_description,
          price_cents: Math.round(offering.price * 100),
          currency: offering.currency,
          service_type: 'onsite',
          status: 'active',
          image_url: finalImageUrl
        });
        
        if (!result.success) {
          throw new Error(result.error || 'Failed to create offering');
        }
        console.log('✅ Successfully created offering:', offering.name);
      }

      // Update existing offerings
      for (const offering of offeringsToUpdate) {
        console.log('✏️ Updating offering:', offering.name);
        let finalImageUrl = '';
        
        // Check if this is the currently edited offering with a new file
        if (offering.id === newOffering.id && newOfferingFile) {
          console.log('📤 Uploading new image for updated offering:', offering.name);
          const uploadedUrl = await uploadImageToSupabase(newOfferingFile, 'offerings');
          if (uploadedUrl) {
            finalImageUrl = uploadedUrl;
            console.log('✅ New image uploaded successfully:', uploadedUrl);
          } else {
            console.warn(`❌ Failed to upload new image for offering: ${offering.name}`);
            finalImageUrl = offering.image_url && !offering.image_url.startsWith('blob:') ? offering.image_url : '';
          }
        } else if (offering.image_url && !offering.image_url.startsWith('blob:')) {
          // Keep existing permanent URL
          finalImageUrl = offering.image_url;
          console.log('🔗 Keeping existing image URL:', finalImageUrl);
        }
        
        const result = await OfferingService.updateOffering(offering.id!, {
          title: offering.name,
          description: offering.short_description,
          price_cents: Math.round(offering.price * 100),
          currency: offering.currency,
          image_url: finalImageUrl
        });
        
        if (!result.success) {
          throw new Error(result.error || 'Failed to update offering');
        }
        console.log('✅ Successfully updated offering:', offering.name);
      }

      console.log('🎉 All offerings processed successfully');
      
      // Clear the current form if we were editing
      if (newOffering.id) {
        clearForm();
      }
      
      navigate('/dashboard');
    } catch (error) {
      console.error('Error saving offerings:', error);
      showError(`Error saving offerings: ${error instanceof Error ? error.message : 'Please try again.'}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary-500 border-t-transparent mx-auto mb-4"></div>
          <p className="font-lora text-lg text-neutral-600">Loading business data...</p>
        </div>
      </div>
    );
  }

  if (error || !business) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-cinzel text-2xl font-bold text-neutral-900 mb-4">
            Error Loading Business
          </h1>
          <p className="font-lora text-neutral-600 mb-6">
            {error || 'Business not found'}
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="font-poppins bg-primary-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-600 transition-colors duration-200"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-neutral-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div>
            <div className="flex items-center">
              <button
                onClick={() => navigate('/dashboard')}
                className="mr-4 p-2 rounded-full hover:bg-neutral-100 transition-colors duration-200"
              >
                <ArrowLeft className="h-5 w-5 text-neutral-600" />
              </button>
              <div className="flex items-center">
                {business.image_url && (
                  <img
                    src={business.image_url}
                    alt={business.name}
                    className="w-12 h-12 rounded-lg object-cover mr-4"
                  />
                )}
                <div>
                  <h1 className="font-cinzel text-2xl font-bold text-neutral-900">
                    {business.name}
                  </h1>
                </div>
              </div>
            </div>
          </div>
          
          {/* Edit Business Button - Full Width Row */}
          <div className="mt-4">
            <button
              onClick={() => navigate(`/add-business?edit=${businessId}`)}
              className="w-full font-poppins bg-gradient-to-r from-primary-500 to-accent-500 text-white p-3 rounded-lg font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 flex items-center justify-center"
            >
              <Edit className="h-5 w-5 mr-2" />
              Edit Business Info
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Add New Offering */}
          <div className="bg-white rounded-2xl shadow-lg border border-neutral-200 overflow-hidden">
            <div className="bg-gradient-to-r from-primary-500 to-accent-500 p-6 text-white">
              <h2 className="font-cinzel text-2xl font-bold mb-2">
                {isEditMode ? 'EDIT OFFERING' : 'CREATE YOUR MENU OFFERINGS'}
              </h2>
              <p className="font-lora text-white/90">
                {isEditMode 
                  ? 'Update your offering details and save changes.'
                  : 'Upload at least 10 menu items for the best results. The more offerings you add, the easier it is for customers to find you.'
                }
              </p>
            </div>
            
            <div className="p-6 space-y-6">
              <div>
                <input
                  type="text"
                  name="name"
                  value={newOffering.name}
                  onChange={handleNewOfferingInputChange}
                  className="w-full px-4 py-4 bg-neutral-100 border-0 rounded-xl font-poppins font-medium text-neutral-800 placeholder-neutral-500 focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all duration-200"
                  placeholder="NAME"
                />
              </div>
              
              <div>
                <textarea
                  name="short_description"
                  value={newOffering.short_description}
                  onChange={handleNewOfferingInputChange}
                  rows={3}
                  className="w-full px-4 py-4 bg-neutral-100 border-0 rounded-xl font-lora text-neutral-800 placeholder-neutral-500 focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all duration-200 resize-none"
                  placeholder="SHORT DESCRIPTION"
                />
              </div>
              
              <div>
                <div className="border-2 border-dashed border-neutral-300 rounded-xl p-8 text-center bg-neutral-50 hover:bg-neutral-100 transition-colors duration-200">
                  {newOfferingImagePreview ? (
                    <div className="relative w-32 h-32 mx-auto">
                      <img 
                        src={newOfferingImagePreview} 
                        alt="Offering Preview" 
                        className="w-full h-full object-cover rounded-xl shadow-md" 
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setNewOffering(prev => ({ ...prev, image_file: null, image_url: '' }));
                          setNewOfferingImagePreview(null);
                        }}
                        className="absolute -top-2 -right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-lg transition-colors duration-200"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer group">
                      <div className="text-neutral-500 group-hover:text-primary-500 transition-colors duration-200">
                        <Camera className="mx-auto h-10 w-10 mb-3" />
                        <span className="block text-lg font-poppins font-semibold">UPLOAD IMAGE</span>
                        <span className="block text-sm font-lora mt-1">Click to select an image</span>
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
              
              <div className="relative">
                <DollarSign className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-500" />
                <input
                  type="number"
                  name="price"
                  value={newOffering.price === 0 ? '' : newOffering.price}
                  onChange={handleNewOfferingInputChange}
                  min="0"
                  step="0.01"
                  className="w-full pl-12 pr-4 py-4 bg-neutral-100 border-0 rounded-xl font-poppins font-medium text-neutral-800 placeholder-neutral-500 focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all duration-200"
                  placeholder="PRICE"
                />
              </div>
              
              <button
                type="button"
                onClick={handleSaveOfferingToLocalState}
                className="w-full px-6 py-4 bg-gradient-to-r from-primary-500 to-accent-500 text-white rounded-xl font-poppins font-bold text-lg uppercase tracking-wide hover:shadow-lg hover:shadow-primary-500/25 transition-all duration-200 flex items-center justify-center"
              >
                {isEditMode ? (
                  <>
                    <Save className="w-6 h-6 mr-2" />
                    Update Offering
                  </>
                ) : (
                  <>
                    <Plus className="w-6 h-6 mr-2" />
                    Add Offering
                  </>
                )}
              </button>
              
              {isEditMode && (
                <button
                  type="button"
                  onClick={clearForm}
                  className="w-full px-6 py-3 bg-neutral-100 text-neutral-700 rounded-xl font-poppins font-semibold hover:bg-neutral-200 transition-all duration-200 flex items-center justify-center"
                >
                  <X className="w-5 h-5 mr-2" />
                  Cancel Edit
                </button>
              )}
            </div>
          </div>

          {/* Right Column - Your Offerings */}
          <div className="bg-white rounded-2xl shadow-lg border border-neutral-200 overflow-hidden">
            <div className="bg-gradient-to-r from-neutral-800 to-neutral-900 p-6 text-white">
              <h2 className="font-cinzel text-2xl font-bold mb-2">
                YOUR OFFERINGS ({offerings.length})
              </h2>
              <p className="font-lora text-white/90">
                {offerings.length === 0 
                  ? 'No offerings added yet'
                  : `${offerings.length} menu items ready for customers`
                }
              </p>
            </div>
            
            <div className="p-6">
              {offerings.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-20 h-20 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Camera className="h-10 w-10 text-neutral-400" />
                  </div>
                  <h3 className="font-poppins text-lg font-semibold text-neutral-700 mb-2">
                    No offerings yet
                  </h3>
                  <p className="font-lora text-neutral-500">
                    Start adding your menu items to help customers find you
                  </p>
                </div>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {offerings.map((offering, index) => (
                    <div key={offering.id || index} className="bg-gradient-to-r from-neutral-50 to-neutral-100 p-4 rounded-xl border border-neutral-200 hover:shadow-md transition-all duration-200 group">
                      <div className="flex items-center space-x-4">
                        {offering.image_url && (
                          <div className="relative">
                            <img 
                              src={offering.image_url} 
                              alt={offering.name} 
                              className="w-16 h-16 object-cover rounded-lg shadow-sm group-hover:shadow-md transition-shadow duration-200" 
                            />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-poppins font-bold text-neutral-900 text-lg mb-1">
                            {offering.name}
                          </h3>
                          <div className="flex items-center gap-2 mt-2">
                            <button
                              type="button"
                              onClick={() => {
                                // Load this offering into the edit form
                                setNewOffering({
                                  id: offering.id,
                                  name: offering.name,
                                  short_description: offering.short_description,
                                  price: offering.price,
                                  currency: offering.currency,
                                  image_file: null,
                                  image_url: offering.image_url
                                });
                                setNewOfferingImagePreview(offering.image_url || null);
                                setNewOfferingFile(null);
                                setEditingOffering(offering);
                              }}
                              className="p-2 text-neutral-400 hover:text-blue-500 hover:bg-blue-50 rounded-full transition-all duration-200"
                              title="Edit offering"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeOffering(index)}
                              className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all duration-200"
                              title="Remove offering"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Action Bar */}
        <div className="mt-8 bg-white rounded-2xl shadow-lg border border-neutral-200 p-6">
          <div className="flex flex-col items-start gap-4">
            <div className="w-full">
              <h3 className="font-poppins text-lg font-semibold text-neutral-900">
                Ready to save your offerings?
              </h3>
              <p className="font-lora text-neutral-600">
                {offerings.length} offerings will be saved to your business profile
              </p>
            </div>
            
            <div className="flex gap-4 w-full justify-end">
              <button
                onClick={() => navigate('/dashboard')}
                className="font-poppins border-2 border-neutral-300 text-neutral-700 px-6 py-3 rounded-xl font-semibold hover:bg-neutral-50 transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveOfferings}
                disabled={isSaving}
                className="font-poppins bg-gradient-to-r from-primary-500 to-accent-500 text-white px-8 py-3 rounded-xl font-bold hover:shadow-lg hover:shadow-primary-500/25 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {isSaving ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5 mr-2" />
                    Save
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}