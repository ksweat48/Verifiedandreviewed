import React from 'react';
import { ExternalLink, Truck, ShoppingBag, Star } from 'lucide-react';
import { useAnalytics } from '../hooks/useAnalytics';

interface AffiliateLinksProps {
  businessName: string;
  category: string;
  location: string;
}

const AffiliateLinks: React.FC<AffiliateLinksProps> = ({ businessName, category, location }) => {
  const { trackAffiliateClick } = useAnalytics();

  const affiliateLinks = [
    {
      platform: 'DoorDash',
      url: `https://drd.sh/your-affiliate-code/?search=${encodeURIComponent(businessName)}`,
      icon: Truck,
      color: 'bg-red-500 hover:bg-red-600',
      description: 'Order delivery from this restaurant'
    },
    {
      platform: 'Uber Eats',
      url: `https://ubereats.com/your-affiliate-code/?search=${encodeURIComponent(businessName)}`,
      icon: ShoppingBag,
      color: 'bg-black hover:bg-gray-800',
      description: 'Get it delivered with Uber Eats'
    },
    {
      platform: 'Grubhub',
      url: `https://grubhub.com/your-affiliate-code/?search=${encodeURIComponent(businessName)}`,
      icon: Star,
      color: 'bg-orange-500 hover:bg-orange-600',
      description: 'Order through Grubhub'
    }
  ];

  const handleAffiliateClick = (platform: string, url: string) => {
    trackAffiliateClick(platform, businessName);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Only show delivery links for food categories
  const foodCategories = ['healthy-fast-food', 'traditional-fast-food', 'vegan'];
  const showDeliveryLinks = foodCategories.some(cat => category.toLowerCase().includes(cat));

  if (!showDeliveryLinks) {
    return null;
  }

  return (
    <div className="bg-neutral-50 rounded-2xl p-6 mt-6">
      <h3 className="font-poppins text-lg font-semibold text-neutral-900 mb-4 flex items-center">
        <Truck className="h-5 w-5 mr-2 text-primary-500" />
        Order for Delivery
      </h3>
      
      <p className="font-lora text-neutral-600 text-sm mb-4">
        Want to try {businessName}? Order delivery through our trusted partners:
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {affiliateLinks.map((link) => {
          const IconComponent = link.icon;
          return (
            <button
              key={link.platform}
              onClick={() => handleAffiliateClick(link.platform, link.url)}
              className={`${link.color} text-white p-4 rounded-xl transition-colors duration-200 flex flex-col items-center text-center group`}
            >
              <IconComponent className="h-6 w-6 mb-2 group-hover:scale-110 transition-transform duration-200" />
              <span className="font-poppins font-semibold text-sm mb-1">
                {link.platform}
              </span>
              <span className="font-lora text-xs opacity-90">
                {link.description}
              </span>
              <ExternalLink className="h-3 w-3 mt-2 opacity-75" />
            </button>
          );
        })}
      </div>

      <p className="font-lora text-xs text-neutral-500 mt-4 text-center">
        * We may earn a commission from these links at no cost to you. This helps support our review process.
      </p>
    </div>
  );
};

export default AffiliateLinks;