import React from 'react';
import { MapPin, Star, Clock, ArrowRight } from 'lucide-react';

interface OfferingCardProps {
  offeringId: string;
  businessId: string;
  offeringTitle: string;
  offeringImageUrl: string;
  offeringType: string;
  businessName: string;
  businessAddress?: string;
  distance?: number;
  duration?: number;
  businessRating?: number;
  isOpen?: boolean;
  similarity?: number;
  onClick?: () => void;
}

interface LegacyBusinessCardProps {
  id: string;
  name: string;
  image?: string;
  shortDescription?: string;
  rating?: number;
  distance?: number;
  duration?: number;
  isOpen?: boolean;
  similarity?: number;
  onClick?: () => void;
}

type BusinessCardProps = OfferingCardProps | LegacyBusinessCardProps;

const isOfferingCard = (props: BusinessCardProps): props is OfferingCardProps => {
  return 'offeringId' in props;
};

const AIBusinessCard: React.FC<BusinessCardProps> = (props) => {
  const getCallToActionText = (offeringType?: string) => {
    if (!offeringType) return 'View';
    
    switch (offeringType) {
      case 'dish':
      case 'menu_item':
        return 'View Dish';
      case 'product':
        return 'View Item';
      case 'service':
        return 'View Service';
      default:
        return 'View';
    }
  };

  const formatDistance = (distance?: number) => {
    if (!distance || distance === 999999) return null;
    return distance < 1 ? `${Math.round(distance * 5280)} ft` : `${distance.toFixed(1)} mi`;
  };

  const formatDuration = (duration?: number) => {
    if (!duration || duration === 999999) return null;
    return duration < 60 ? `${Math.round(duration)} min` : `${Math.round(duration / 60)}h ${Math.round(duration % 60)}m`;
  };

  if (isOfferingCard(props)) {
    // Offering card rendering
    const {
      offeringTitle,
      offeringImageUrl,
      offeringType,
      businessName,
      businessAddress,
      distance,
      duration,
      businessRating,
      isOpen,
      similarity,
      onClick
    } = props;

    return (
      <div 
        className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer group"
        onClick={onClick}
      >
        <div className="relative">
          <img
            src={offeringImageUrl}
            alt={offeringTitle}
            className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
          />
          
          {similarity && (
            <div className="absolute top-3 right-3 bg-black bg-opacity-70 text-white rounded-full px-2 py-1">
              <span className="text-xs font-semibold">
                {Math.round(similarity * 100)}% match
              </span>
            </div>
          )}

          {isOpen !== undefined && (
            <div className={`absolute top-3 left-3 rounded-full px-2 py-1 text-xs font-semibold ${
              isOpen ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
            }`}>
              {isOpen ? 'Open' : 'Closed'}
            </div>
          )}
        </div>

        <div className="p-6">
          <h3 className="font-bold text-lg text-neutral-900 mb-2 line-clamp-2">
            {offeringTitle}
          </h3>
          
          <p className="text-neutral-600 text-sm mb-3 font-medium">
            at {businessName}
          </p>

          <div className="space-y-2 mb-4">
            {businessAddress && (
              <div className="flex items-center text-neutral-500 text-sm">
                <MapPin className="h-4 w-4 mr-2 flex-shrink-0" />
                <span className="truncate">{businessAddress}</span>
              </div>
            )}

            <div className="flex items-center justify-between text-sm">
              {formatDistance(distance) && (
                <div className="flex items-center text-neutral-500">
                  <span>{formatDistance(distance)}</span>
                  {formatDuration(duration) && (
                    <span className="ml-2">• {formatDuration(duration)}</span>
                  )}
                </div>
              )}

              {businessRating && (
                <div className="flex items-center">
                  <Star className="h-4 w-4 text-yellow-400 fill-current mr-1" />
                  <span className="font-semibold text-neutral-700">{businessRating}</span>
                </div>
              )}
            </div>
          </div>

          <button className="w-full bg-primary-500 text-white py-3 px-4 rounded-lg font-semibold hover:bg-primary-600 transition-colors duration-200 flex items-center justify-center group">
            <span>{getCallToActionText(offeringType)}</span>
            <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform duration-200" />
          </button>
        </div>
      </div>
    );
  } else {
    // Legacy business card rendering
    const {
      name,
      image,
      shortDescription,
      rating,
      distance,
      duration,
      isOpen,
      similarity,
      onClick
    } = props;

    return (
      <div 
        className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer group"
        onClick={onClick}
      >
        <div className="relative">
          <img
            src={image || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=800'}
            alt={name}
            className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
          />
          
          {similarity && (
            <div className="absolute top-3 right-3 bg-black bg-opacity-70 text-white rounded-full px-2 py-1">
              <span className="text-xs font-semibold">
                {Math.round(similarity * 100)}% match
              </span>
            </div>
          )}

          {isOpen !== undefined && (
            <div className={`absolute top-3 left-3 rounded-full px-2 py-1 text-xs font-semibold ${
              isOpen ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
            }`}>
              {isOpen ? 'Open' : 'Closed'}
            </div>
          )}
        </div>

        <div className="p-6">
          <h3 className="font-bold text-lg text-neutral-900 mb-2 line-clamp-2">
            {name}
          </h3>
          
          {shortDescription && (
            <p className="text-neutral-600 text-sm mb-3 line-clamp-2">
              {shortDescription}
            </p>
          )}

          <div className="flex items-center justify-between text-sm mb-4">
            {formatDistance(distance) && (
              <div className="flex items-center text-neutral-500">
                <span>{formatDistance(distance)}</span>
                {formatDuration(duration) && (
                  <span className="ml-2">• {formatDuration(duration)}</span>
                )}
              </div>
            )}

            {rating && (
              <div className="flex items-center">
                <Star className="h-4 w-4 text-yellow-400 fill-current mr-1" />
                <span className="font-semibold text-neutral-700">{rating}</span>
              </div>
            )}
          </div>

          <button className="w-full bg-primary-500 text-white py-3 px-4 rounded-lg font-semibold hover:bg-primary-600 transition-colors duration-200 flex items-center justify-center group">
            <span>View</span>
            <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform duration-200" />
          </button>
        </div>
      </div>
    );
  }
};

export default AIBusinessCard;