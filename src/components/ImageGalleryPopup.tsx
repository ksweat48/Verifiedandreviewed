import React, { useState, useEffect } from 'react';
import * as Icons from 'lucide-react';
import { useModalControl } from '../hooks/useModalControl';

interface ImageGalleryPopupProps {
  isOpen: boolean;
  onClose: () => void;
  images: Array<{url: string; alt?: string}>;
  initialIndex?: number;
}

const ImageGalleryPopup: React.FC<ImageGalleryPopupProps> = ({ 
  isOpen, 
  onClose, 
  images, 
  initialIndex = 0 
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  // Use centralized modal control
  useModalControl({ isOpen, onClose });

  // Reset current index when images change
  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [images, initialIndex]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      
      switch (e.key) {
        case 'ArrowLeft':
          prevImage();
          break;
        case 'ArrowRight':
          nextImage();
          break;
        case 'Escape':
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, images.length]);

  const nextImage = () => {
    if (images.length <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    if (images.length <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Close button */}
      <button 
        className="absolute top-4 right-4 text-white p-2 rounded-full hover:bg-white hover:bg-opacity-20 transition-colors duration-200 z-20"
        onClick={onClose}
        aria-label="Close gallery"
      >
        <Icons.X className="h-6 w-6" />
      </button>

      {/* Navigation buttons */}
      {images.length > 1 && (
        <>
          <button 
            className="absolute left-4 text-white p-2 rounded-full hover:bg-white hover:bg-opacity-20 transition-colors duration-200 z-20"
            onClick={(e) => {
              e.stopPropagation();
              prevImage();
            }}
            aria-label="Previous image"
          >
            <Icons.ChevronLeft className="h-8 w-8" />
          </button>
          
          <button 
            className="absolute right-4 text-white p-2 rounded-full hover:bg-white hover:bg-opacity-20 transition-colors duration-200 z-20"
            onClick={(e) => {
              e.stopPropagation();
              nextImage();
            }}
            aria-label="Next image"
          >
            <Icons.ChevronRight className="h-8 w-8" />
          </button>
        </>
      )}

      {/* Image */}
      <div 
        className="relative max-w-4xl max-h-[90vh] w-full h-full flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={images[currentIndex]?.url}
          alt={`Gallery image ${currentIndex + 1}`}
          className="max-w-full max-h-full object-contain"
        />
      </div>

      {/* Image counter */}
      {images.length > 1 && (
        <>
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-50 text-white px-4 py-2 rounded-full text-sm">
            {currentIndex + 1} / {images.length}
          </div>
          
          {/* Bottom Close Button */}
          <button
            onClick={onClose}
            className="absolute bottom-4 right-4 bg-white text-black px-4 py-2 rounded-lg font-poppins font-semibold hover:bg-opacity-90 transition-colors duration-200"
          >
            Close
          </button>
        </>
      )}
    </div>
  );
};

export default ImageGalleryPopup;