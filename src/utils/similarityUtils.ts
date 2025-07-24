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