import { useEffect } from 'react';

interface UseModalControlOptions {
  isOpen: boolean;
  onClose: () => void;
  preventBodyScroll?: boolean;
  handleBackButton?: boolean;
}

export const useModalControl = ({
  isOpen,
  onClose,
  preventBodyScroll = true,
  handleBackButton = true
}: UseModalControlOptions) => {
  // Prevent body scrolling when modal is open
  useEffect(() => {
    if (!preventBodyScroll) return;
    
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isOpen, preventBodyScroll]);

  // Handle browser back button for modal
  useEffect(() => {
    if (!handleBackButton || !isOpen) return;
    
    window.history.pushState(null, '', window.location.href);
    
    const handlePopState = () => {
      if (isOpen) {
        onClose();
      }
    };
    
    window.addEventListener('popstate', handlePopState);
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isOpen, onClose, handleBackButton]);
};