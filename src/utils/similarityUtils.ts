/**
 * Similarity Score Utilities
 * Handles conversion of raw similarity scores to user-friendly match percentages
 */

/**
 * Convert raw similarity score to match percentage
 * 
 * Mapping:
 * - Raw score -0.5 (or lower) = 0% match (strong dissimilarity)
 * - Raw score 0.0 = 50% match (neutral)
 * - Raw score 0.5 (or higher) = 100% match (strong similarity)
 * 
 * @param similarity Raw similarity score from semantic search
 * @returns Match percentage (0-100)
 */
export const getMatchPercentage = (similarity: number | undefined): number => {
  if (similarity === undefined || similarity === null) return 0;
  
  // Clamp the similarity score between -0.5 and 0.5
  const clampedSimilarity = Math.max(-0.5, Math.min(0.5, similarity));
  
  // Linear mapping from [-0.5, 0.5] to [0, 100]
  // Formula: ((clampedSimilarity + 0.5) / 1.0) * 100
  const percentage = ((clampedSimilarity + 0.5) / 1.0) * 100;
  
  return Math.round(percentage);
};

/**
 * Convert match percentage back to normalized similarity score (0-1) for composite scoring
 * 
 * @param similarity Raw similarity score
 * @returns Normalized similarity score (0-1) for use in composite formula
 */
export const getNormalizedSimilarity = (similarity: number | undefined): number => {
  const matchPercentage = getMatchPercentage(similarity);
  return matchPercentage / 100;
};

/**
 * Calculate composite score for business ranking
 * 
 * @param business Business object with similarity, distance, isOpen, isPlatformBusiness
 * @returns Composite score (0-1)
 */
export const calculateCompositeScore = (business: {
  similarity?: number;
  distance?: number;
  isOpen?: boolean;
  isPlatformBusiness?: boolean;
}): number => {
  // Normalize similarity score (0-1)
  const normalizedSimilarity = getNormalizedSimilarity(business.similarity);
  
  // Convert platform status to 0 or 1
  const isPlatformBusiness = business.isPlatformBusiness ? 1 : 0;
  
  // Convert open status to 0 or 1
  const isOpen = business.isOpen ? 1 : 0;
  
  // Normalize distance (clamp to 0-10 miles, then convert to 0-1 scale)
  const clampedDistance = Math.max(0, Math.min(10, business.distance || 10));
  const normalizedDistance = 1 - (clampedDistance / 10);
  
  // Calculate composite score using the specified weights
  const compositeScore = (
    0.45 * normalizedSimilarity +
    0.25 * isPlatformBusiness +
    0.20 * isOpen +
    0.10 * normalizedDistance
  );
  
  return Math.round(compositeScore * 1000) / 1000; // Round to 3 decimal places
};
/**
 * Check if a similarity score meets the minimum threshold for display
 * 
 * @param similarity Raw similarity score
 * @param threshold Minimum absolute similarity threshold (default: 0.0)
 * @returns Whether the business should be displayed
 */
export const meetsDisplayThreshold = (similarity: number | undefined, threshold: number = 0.0): boolean => {
  if (similarity === undefined || similarity === null) return false;
  return Math.abs(similarity) >= threshold;
};