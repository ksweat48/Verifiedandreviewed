// Utility functions for calculating similarity and composite scores

export function calculateCompositeScore(
  similarity: number,
  distance: number,
  rating: number,
  isOpen: boolean = true
): number {
  // Normalize similarity (0-1)
  const normalizedSimilarity = Math.max(0, Math.min(1, similarity));
  
  // Normalize distance (inverse, so closer = higher score)
  // Cap at 50 miles for normalization
  const maxDistance = 50;
  const normalizedDistance = distance > maxDistance ? 0 : (maxDistance - distance) / maxDistance;
  
  // Normalize rating (0-1, assuming 5-star scale)
  const normalizedRating = Math.max(0, Math.min(1, rating / 5));
  
  // Apply weights
  const similarityWeight = 0.5;
  const distanceWeight = 0.3;
  const ratingWeight = 0.2;
  
  // Calculate composite score
  let compositeScore = (
    normalizedSimilarity * similarityWeight +
    normalizedDistance * distanceWeight +
    normalizedRating * ratingWeight
  );
  
  // Apply penalty for closed businesses
  if (!isOpen) {
    compositeScore *= 0.7;
  }
  
  return Math.max(0, Math.min(1, compositeScore));
}

export function calculateOfferingCompositeScore(
  similarity: number,
  distance: number,
  businessRating: number,
  isOpen: boolean = true
): number {
  // For offering search, prioritize similarity more heavily
  const normalizedSimilarity = Math.max(0, Math.min(1, similarity));
  
  // Normalize distance (inverse, so closer = higher score)
  const maxDistance = 50;
  const normalizedDistance = distance > maxDistance ? 0 : (maxDistance - distance) / maxDistance;
  
  // Normalize business rating (0-1, assuming 5-star scale)
  const normalizedRating = Math.max(0, Math.min(1, businessRating / 5));
  
  // Adjusted weights for offering search - prioritize similarity
  const similarityWeight = 0.6;
  const distanceWeight = 0.25;
  const ratingWeight = 0.15;
  
  // Calculate composite score
  let compositeScore = (
    normalizedSimilarity * similarityWeight +
    normalizedDistance * distanceWeight +
    normalizedRating * ratingWeight
  );
  
  // Apply penalty for closed businesses
  if (!isOpen) {
    compositeScore *= 0.7;
  }
  
  return Math.max(0, Math.min(1, compositeScore));
}

export function getMatchPercentage(similarity: number): number {
  return Math.round(similarity * 100);
}