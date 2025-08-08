/**
 * Utility functions for similarity calculations and business processing
 */

// Helper function to calculate cosine similarity between two vectors
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have the same length');
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);
  
  if (normA === 0 || normB === 0) {
    return 0;
  }
  
  return dotProduct / (normA * normB);
}

// Helper function to calculate distance between two coordinates in miles
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Helper function to process Google Places result into business object
export function processGooglePlacesResult(result: any, googlePlacesApiKey: string, prompt: string): any {
  const businessLatitude = result.geometry?.location?.lat;
  const businessLongitude = result.geometry?.location?.lng;
  
  // Parse opening hours
  let businessHours = 'Hours not available';
  let isOpen = true;
  
  if (result.opening_hours) {
    isOpen = result.opening_hours.open_now !== undefined ? result.opening_hours.open_now : true;
    if (result.opening_hours.weekday_text && result.opening_hours.weekday_text.length > 0) {
      const today = new Date().getDay();
      businessHours = result.opening_hours.weekday_text[today] || result.opening_hours.weekday_text[0];
    }
  }
  
  // Generate a short description based on the business type and rating
  const businessTypes = result.types ? result.types.join(', ') : 'establishment';
  const shortDescription = result.rating 
    ? `${result.name} is a highly-rated ${businessTypes} with ${result.rating} stars. Known for excellent service and great atmosphere.`
    : `${result.name} is a ${businessTypes}. Known for excellent service and great atmosphere.`;
  
  // Get a photo URL if available
  const photoReference = result.photos && result.photos.length > 0 ? result.photos[0].photo_reference : null;
  const imageUrl = photoReference 
    ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photoReference}&key=${googlePlacesApiKey}` 
    : 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400';
  
  // Create business text for later batch embedding generation
  const businessText = [
    result.name,
    prompt, // The original user prompt
    businessTypes,
    result.rating ? `${result.rating} star rating` : 'no rating available',
    result.vicinity || '',
    businessHours
  ].filter(Boolean).join(' ');
  
  return {
    id: `google-${result.place_id}`,
    name: result.name,
    shortDescription: shortDescription,
    rating: {
      thumbsUp: Math.floor((result.rating || 0) * 2),
      thumbsDown: 0,
      sentimentScore: Math.round((result.rating || 0) * 20)
    },
    image: imageUrl,
    isOpen: isOpen,
    hours: businessHours,
    address: result.formatted_address || result.vicinity,
    latitude: businessLatitude || null,
    longitude: businessLongitude || null,
    distance: 999999, // Will be calculated accurately later
    duration: 999999, // Will be calculated accurately later
    placeId: result.place_id,
    reviews: [{
      text: `Great place that matches your vibe! Really enjoyed the atmosphere and service here.`,
      author: "Google User",
      authorImage: "https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=100",
      images: [],
      thumbsUp: true
    }],
    isPlatformBusiness: false,
    tags: result.types || [],
    isGoogleVerified: true,
    businessText: businessText,
    similarity: 0.8 // Temporary value, will be calculated in batch
  };
}

// Convert similarity score (0-1) to percentage string
export function getMatchPercentage(similarity: number): string {
  const percentage = Math.round(similarity * 100);
  return `${percentage}`;
}

// Calculate composite score for offering search results
export function calculateOfferingCompositeScore(
  similarity: number,
  distance?: number,
  businessRating?: number
): number {
  let score = similarity * 100; // Base score from semantic similarity (0-100)
  
  // Distance bonus (closer is better)
  if (distance !== undefined && distance !== null && distance < 999999) {
    const distanceBonus = Math.max(0, 20 - distance * 2); // Up to 20 points for very close businesses
    score += distanceBonus;
  }
  
  // Business rating bonus
  if (businessRating !== undefined && businessRating !== null) {
    const ratingBonus = (businessRating / 5) * 10; // Up to 10 points for 5-star businesses
    score += ratingBonus;
  }
  
  return Math.min(100, score); // Cap at 100
}