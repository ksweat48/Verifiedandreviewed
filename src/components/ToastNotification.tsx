import React, { useEffect, useState } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
  isVisible: boolean;
  onClose: () => void;
}

const ToastNotification: React.FC<ToastProps> = ({
  message,
  type,
  duration = 4000,
  isVisible,
  onClose
}) => {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setIsAnimating(true);
      
      // Auto-dismiss after duration
      const timer = setTimeout(() => {
        handleClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [isVisible, duration]);

  const handleClose = () => {
    setIsAnimating(false);
    setTimeout(() => {
      onClose();
    }, 300); // Wait for animation to complete
  };

  if (!isVisible) return null;

  const getToastStyles = () => {
    switch (type) {
      case 'success':
        return {
          bg: 'bg-green-50 border-green-200',
          text: 'text-green-800',
          icon: CheckCircle,
          iconColor: 'text-green-500'
        };
      case 'error':
        return {
          bg: 'bg-red-50 border-red-200',
          text: 'text-red-800',
          icon: AlertCircle,
          iconColor: 'text-red-500'
        };
      case 'warning':
        return {
          bg: 'bg-yellow-50 border-yellow-200',
          text: 'text-yellow-800',
          icon: AlertTriangle,
          iconColor: 'text-yellow-500'
        };
      case 'info':
      default:
        return {
          bg: 'bg-blue-50 border-blue-200',
          text: 'text-blue-800',
          icon: Info,
          iconColor: 'text-blue-500'
        };
    }
  };

  const styles = getToastStyles();
  const IconComponent = styles.icon;

  return (
    <div className="fixed top-4 right-4 z-50 pointer-events-none">
      <div
        className={`pointer-events-auto max-w-sm w-full ${styles.bg} border rounded-2xl shadow-lg p-4 transition-all duration-300 transform ${
          isAnimating ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
        }`}
      >
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <IconComponent className={`h-5 w-5 ${styles.iconColor}`} />
          </div>
          <div className="ml-3 flex-1">
            <p className={`font-lora text-sm ${styles.text} leading-relaxed`}>
              {message}
            </p>
          </div>
          <div className="ml-4 flex-shrink-0">
            <button
              onClick={handleClose}
              className={`inline-flex rounded-lg p-1.5 ${styles.text} hover:bg-black hover:bg-opacity-10 transition-colors duration-200`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ToastNotification;