import React from 'react';
import { Zap } from 'lucide-react';

interface FallingCreditsProps {
  count?: number;
}

const FallingCredits: React.FC<FallingCreditsProps> = ({ count = 15 }) => {
  // Generate array of credit elements with random properties
  const credits = Array.from({ length: count }, (_, index) => ({
    id: index,
    left: Math.random() * 100, // Random horizontal position (0-100%)
    delay: Math.random() * 5, // Random delay (0-5 seconds)
    duration: 3 + Math.random() * 2, // Random duration (3-5 seconds)
    size: 0.8 + Math.random() * 0.4, // Random size (0.8-1.2)
    opacity: 0.3 + Math.random() * 0.4 // Random opacity (0.3-0.7)
  }));

  return (
    <div className="falling-credits-container">
      {credits.map((credit) => (
        <div
          key={credit.id}
          className="falling-credit"
          style={{
            left: `${credit.left}%`,
            animationDelay: `${credit.delay}s`,
            animationDuration: `${credit.duration}s`,
            transform: `scale(${credit.size})`,
            opacity: credit.opacity
          }}
        >
          <Zap className="h-4 w-4 text-yellow-400" />
        </div>
      ))}
    </div>
  );
};

export default FallingCredits;