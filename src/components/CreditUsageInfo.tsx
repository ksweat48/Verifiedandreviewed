import React, { useState } from 'react';
import { Zap, Info } from 'lucide-react';

interface CreditUsageInfoProps {
  className?: string;
}

const CreditUsageInfo: React.FC<CreditUsageInfoProps> = ({ className = '' }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  return (
    <div className={`bg-primary-50 rounded-xl p-4 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-poppins font-semibold text-primary-900 flex items-center">
          <Zap className="h-4 w-4 mr-2 text-primary-500" />
          Credit Usage
        </h4>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-primary-700 hover:text-primary-900 transition-colors duration-200"
        >
          <Info className="h-4 w-4" />
        </button>
      </div>
      
      <div className="font-lora text-sm text-primary-700">
        <div className="flex justify-between">
          <span>All searches (intelligent unified):</span>
          <span className="font-semibold">2 credits</span>
        </div>
      </div>
      
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-primary-200 font-lora text-xs text-primary-600 space-y-2">
          <p>Our intelligent search system automatically combines offerings, platform businesses, and AI suggestions for the best results.</p>
          <p className="font-semibold">Earn credits by:</p>
          <ul className="space-y-1 pl-4">
            <li>• Reviews (2 credits each)</li>
            <li>• Referrals (20 credits each)</li>
            <li>• Monthly refills (50 credits)</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default CreditUsageInfo;