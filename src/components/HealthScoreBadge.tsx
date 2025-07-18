import React, { useState } from 'react';
import { Info } from 'lucide-react';

interface HealthScoreBadgeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
}

const HealthScoreBadge: React.FC<HealthScoreBadgeProps> = ({ 
  score, 
  size = 'md', 
  showTooltip = true 
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const getHealthScoreColor = (score: number) => {
    if (score >= 90) return { 
      bg: 'bg-green-500', 
      text: 'text-green-700', 
      bgLight: 'bg-green-100',
      border: 'border-green-200'
    };
    if (score >= 70 && score < 80) return { 
      bg: 'bg-blue-500', 
      text: 'text-blue-700', 
      bgLight: 'bg-blue-100',
      border: 'border-blue-200'
    };
    if (score >= 65 && score < 70) return { 
      bg: 'bg-yellow-500', 
      text: 'text-yellow-700', 
      bgLight: 'bg-yellow-100',
      border: 'border-yellow-200'
    };
    return { 
      bg: 'bg-red-500', 
      text: 'text-red-700', 
      bgLight: 'bg-red-100',
      border: 'border-red-200'
    };
  };

  const getHealthScoreDescription = (score: number) => {
    if (score >= 80) return 'Exceptionally clean & health-forward';
    if (score >= 70 && score < 80) return 'Good standards with minor improvements needed';
    if (score >= 65 && score < 70) return 'Fair standards with some improvements needed';
    return 'Needs significant improvement (not seal-eligible)';
  };

  const getHealthScoreIcon = (score: number) => {
    if (score >= 80) return '✅';
    if (score >= 70 && score < 80) return '🔵';
    if (score >= 65 && score < 70) return '⚠️';
    return '🔴';
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'px-2 py-1 text-xs';
      case 'lg':
        return 'px-4 py-2 text-base';
      default:
        return 'px-3 py-1 text-sm';
    }
  };

  const colors = getHealthScoreColor(score);

  const HealthScoreTooltip = () => (
    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 bg-white border border-neutral-200 rounded-lg shadow-lg p-4 z-50">
      <div className="flex items-center mb-2">
        <span className="text-lg mr-2">{getHealthScoreIcon(score)}</span>
        <span className="font-poppins font-semibold text-neutral-900">
          Health Score: {score}/100
        </span>
      </div>
      <p className="font-lora text-sm text-neutral-700 mb-3">
        {getHealthScoreDescription(score)}
      </p>
      <div className="text-xs text-neutral-600">
        <p className="font-poppins font-semibold mb-1">Score based on:</p>
        <ul className="font-lora space-y-1">
          <li>• Food handling & sanitation</li>
          <li>• Visible mold, odor, or pest indicators</li>
          <li>• Cross-contamination risks</li>
          <li>• Water station conditions</li>
          <li>• Cleanliness of high-touch areas</li>
        </ul>
      </div>
    </div>
  );

  return (
    <div 
      className="relative inline-block"
      onMouseEnter={() => showTooltip && setIsHovered(true)}
      onMouseLeave={() => showTooltip && setIsHovered(false)}
    >
      <div className={`${colors.bgLight} ${colors.text} ${colors.border} border rounded-full flex items-center ${getSizeClasses()} ${showTooltip ? 'cursor-help' : ''}`}>
        <span className="font-poppins font-bold mr-1">
          Health: {score}
        </span>
        {showTooltip && <Info className="h-3 w-3" />}
      </div>
      
      {showTooltip && isHovered && <HealthScoreTooltip />}
    </div>
  );
};

export default HealthScoreBadge;