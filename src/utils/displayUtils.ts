// Display utilities for consistent UI elements across the app

// Diverse default avatars for users without custom avatars
export const defaultAvatars = [
  'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=100',
  'https://images.pexels.com/photos/1126993/pexels-photo-1126993.jpeg?auto=compress&cs=tinysrgb&w=100',
  'https://images.pexels.com/photos/1300402/pexels-photo-1300402.jpeg?auto=compress&cs=tinysrgb&w=100',
  'https://images.pexels.com/photos/1681010/pexels-photo-1681010.jpeg?auto=compress&cs=tinysrgb&w=100',
  'https://images.pexels.com/photos/1043471/pexels-photo-1043471.jpeg?auto=compress&cs=tinysrgb&w=100',
  'https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=100',
  'https://images.pexels.com/photos/1130626/pexels-photo-1130626.jpeg?auto=compress&cs=tinysrgb&w=100',
  'https://images.pexels.com/photos/1484794/pexels-photo-1484794.jpeg?auto=compress&cs=tinysrgb&w=100',
  'https://images.pexels.com/photos/1542085/pexels-photo-1542085.jpeg?auto=compress&cs=tinysrgb&w=100',
  'https://images.pexels.com/photos/1674752/pexels-photo-1674752.jpeg?auto=compress&cs=tinysrgb&w=100'
];

// Get a consistent avatar for a user ID
export const getAvatarForUser = (userId: string, customAvatar?: string): string => {
  if (customAvatar && customAvatar.trim() !== '') {
    return customAvatar;
  }
  
  // Use user ID to consistently assign the same default avatar
  const hash = userId.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  
  const index = Math.abs(hash) % defaultAvatars.length;
  return defaultAvatars[index];
};

// Get sentiment rating text and color based on score
export const getSentimentRating = (score: number) => {
  if (score >= 80) return { text: 'Great', color: 'bg-green-500' };
  if (score >= 70) return { text: 'Good', color: 'bg-blue-500' };
  if (score >= 65) return { text: 'Fair', color: 'bg-yellow-500' };
  return { text: 'Improve', color: 'bg-red-500' };
};

// Get service type badge configuration
export const getServiceTypeBadge = (serviceType: string) => {
  const badges = {
    onsite: { label: 'On-site', color: 'bg-blue-100 text-blue-700' },
    mobile: { label: 'Mobile', color: 'bg-green-100 text-green-700' },
    remote: { label: 'Remote', color: 'bg-purple-100 text-purple-700' },
    delivery: { label: 'Delivery', color: 'bg-orange-100 text-orange-700' }
  };
  return badges[serviceType as keyof typeof badges] || badges.onsite;
};

// Format price from cents to currency string
export const formatPrice = (priceCents?: number, currency: string = 'USD'): string => {
  if (!priceCents) return 'Free';
  const price = priceCents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(price);
};

// Get price range text from symbols
export const getPriceRangeText = (priceRange?: string) => {
  switch (priceRange) {
    case '$': return 'Budget';
    case '$$': return 'Moderate';
    case '$$$': return 'Expensive';
    case '$$$$': return 'Very Expensive';
    default: return priceRange || 'Not specified';
  }
};