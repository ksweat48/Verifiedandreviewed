import React, { useState } from 'react';
import { Info, X } from 'lucide-react';

interface CreditInfoTooltipProps {
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

const CreditInfoTooltip: React.FC<CreditInfoTooltipProps> = ({ placement = 'bottom' }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const getPlacementStyles = () => {
    switch (placement) {
      case 'top':
        return 'bottom-full left-1/2 transform -translate-x-1/2 mb-2';
      case 'bottom':
        return 'top-full left-1/2 transform -translate-x-1/2 mt-2';
      case 'left':
        return 'right-full top-1/2 transform -translate-y-1/2 mr-2';
      case 'right':
        return 'left-full top-1/2 transform -translate-y-1/2 ml-2';
      default:
        return 'top-full left-1/2 transform -translate-x-1/2 mt-2';
    }
  };
  
  return (
    <div className="relative inline-block">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-neutral-400 hover:text-primary-500 transition-colors duration-200"
        aria-label="Credit information"
      >
        <Info className="h-4 w-4" />
      </button>
      
      {isOpen && (
        <div className={`absolute ${getPlacementStyles()} z-50 w-64 bg-white rounded-xl shadow-lg border border-neutral-200 p-4`}>
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-poppins font-semibold text-neutral-900">
              Credit Usage
            </h4>
            <button
              onClick={() => setIsOpen(false)}
              className="text-neutral-400 hover:text-neutral-600 transition-colors duration-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          
          <div className="space-y-2 font-lora text-sm text-neutral-700">
            <p className="flex items-center">
              <span className="w-5 h-5 bg-primary-100 rounded-full flex items-center justify-center mr-2 flex-shrink-0">
                1
              </span>
              Platform-only searches cost 1 credit
            </p>
            <p className="flex items-center">
              <span className="w-5 h-5 bg-primary-100 rounded-full flex items-center justify-center mr-2 flex-shrink-0">
                10
              </span>
              AI-assisted searches cost 10 credits
            </p>
            <div className="border-t border-neutral-100 pt-2 mt-2">
              <p className="text-xs text-neutral-500">
                The system first checks for matches in our platform database. If fewer than 6 matches are found, AI is used to fill in additional results.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreditInfoTooltip;