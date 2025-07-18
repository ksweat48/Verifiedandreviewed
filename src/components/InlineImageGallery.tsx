import React, { useState } from 'react';
import { ZoomIn, X, ChevronLeft, ChevronRight } from 'lucide-react';

interface InlineImageGalleryProps {
  images: string[];
  className?: string;
}

const InlineImageGallery: React.FC<InlineImageGalleryProps> = ({ images, className = '' }) => {
  const [lightboxImage, setLightboxImage] = useState<number | null>(null);

  if (!images || images.length === 0) {
    return null;
  }

  const openLightbox = (index: number) => {
    setLightboxImage(index);
  };

  const closeLightbox = () => {
    setLightboxImage(null);
  };

  const nextImage = () => {
    if (lightboxImage !== null) {
      setLightboxImage((lightboxImage + 1) % images.length);
    }
  };

  const prevImage = () => {
    if (lightboxImage !== null) {
      setLightboxImage(lightboxImage === 0 ? images.length - 1 : lightboxImage - 1);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowRight') nextImage();
    if (e.key === 'ArrowLeft') prevImage();
  };

  // Desktop: Show all 5 images, Mobile: Show only 3 images
  const displayImages = images.slice(0, 5);
  const mobileDisplayImages = images.slice(0, 3);

  return (
    <>
      {/* Inline Gallery - Spans full width under featured image */}
      <div className={`my-8 ${className}`}>
        {/* Desktop Gallery - All 5 images */}
        <div className="hidden md:flex gap-4">
          {displayImages.map((image, index) => (
            <div
              key={index}
              className="relative flex-1 h-32 cursor-pointer group overflow-hidden rounded-xl border-2 border-neutral-200 hover:border-primary-500 transition-all duration-300 hover:shadow-lg"
              onClick={() => openLightbox(index)}
            >
              <img
                src={image}
                alt={`Gallery ${index + 1}`}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                loading="lazy"
              />
              
              {/* Hover Overlay */}
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-300 flex items-center justify-center">
                <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>

              {/* Image Number Badge */}
              <div className="absolute top-2 left-2 bg-black bg-opacity-70 text-white rounded-full w-6 h-6 flex items-center justify-center">
                <span className="font-poppins text-xs font-bold">{index + 1}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Mobile Gallery - Only 3 images */}
        <div className="flex md:hidden gap-3">
          {mobileDisplayImages.map((image, index) => (
            <div
              key={index}
              className="relative flex-1 h-24 cursor-pointer group overflow-hidden rounded-lg border-2 border-neutral-200 hover:border-primary-500 transition-all duration-300"
              onClick={() => openLightbox(index)}
            >
              <img
                src={image}
                alt={`Gallery ${index + 1}`}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                loading="lazy"
              />
              
              {/* Hover Overlay */}
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-300 flex items-center justify-center">
                <ZoomIn className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>

              {/* Image Number Badge */}
              <div className="absolute top-1 left-1 bg-black bg-opacity-70 text-white rounded-full w-5 h-5 flex items-center justify-center">
                <span className="font-poppins text-xs font-bold">{index + 1}</span>
              </div>
            </div>
          ))}
          
          {/* Show "+X more" indicator on mobile if there are more than 3 images */}
          {displayImages.length > 3 && (
            <div
              className="relative flex-1 h-24 cursor-pointer bg-neutral-100 border-2 border-neutral-200 rounded-lg flex items-center justify-center hover:border-primary-500 transition-all duration-300"
              onClick={() => openLightbox(3)}
            >
              <span className="font-poppins text-sm font-bold text-neutral-600">
                +{displayImages.length - 3}
              </span>
            </div>
          )}
        </div>
        
        {/* Gallery Caption */}
        <p className="font-lora text-sm text-neutral-500 mt-3 text-center">
          {displayImages.length} gallery image{displayImages.length !== 1 ? 's' : ''} • Click to view full size
        </p>
      </div>

      {/* Lightbox */}
      {lightboxImage !== null && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
          onClick={closeLightbox}
          onKeyDown={handleKeyDown}
          tabIndex={0}
        >
          {/* Close Button */}
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 z-10 p-2 bg-white bg-opacity-20 rounded-full text-white hover:bg-opacity-30 transition-colors duration-200"
          >
            <X className="h-6 w-6" />
          </button>

          {/* Navigation Buttons */}
          {images.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  prevImage();
                }}
                className="absolute left-4 top-1/2 transform -translate-y-1/2 z-10 p-2 bg-white bg-opacity-20 rounded-full text-white hover:bg-opacity-30 transition-colors duration-200"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  nextImage();
                }}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 z-10 p-2 bg-white bg-opacity-20 rounded-full text-white hover:bg-opacity-30 transition-colors duration-200"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}

          {/* Image */}
          <div className="max-w-5xl max-h-full flex items-center justify-center">
            <img
              src={images[lightboxImage]}
              alt={`Gallery image ${lightboxImage + 1}`}
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* Image Counter */}
          {images.length > 1 && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-white bg-opacity-20 text-white px-4 py-2 rounded-full">
              <span className="font-poppins text-sm">
                {lightboxImage + 1} of {images.length}
              </span>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default InlineImageGallery;