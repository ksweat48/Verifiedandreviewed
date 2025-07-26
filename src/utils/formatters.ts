/**
 * Number formatting utilities for displaying large numbers in a user-friendly way
 */

/**
 * Format large numbers with k/M suffixes and infinity symbol for admins
 * @param num - The number to format
 * @param isAdmin - Whether the current user is an admin (shows ∞ for very large numbers)
 * @returns Formatted string representation of the number
 */
export const formatLargeNumber = (num: number | undefined | null, isAdmin: boolean = false): string => {
  if (num === undefined || num === null) return '0';
  
  // For admins with very large numbers (999999 or more), show infinity
  if (isAdmin && num >= 999999) {
    return '∞';
  }
  
  // For numbers less than 10,000, show as-is
  if (num < 10000) {
    return num.toString();
  }
  
  // For numbers 10,000 to 999,999, show as "10k", "100k", etc.
  if (num < 1000000) {
    const thousands = Math.floor(num / 1000);
    const remainder = num % 1000;
    
    // If there's a significant remainder, show one decimal place
    if (remainder >= 100) {
      return `${(num / 1000).toFixed(1)}k`;
    } else {
      return `${thousands}k`;
    }
  }
  
  // For numbers 1,000,000 and above, show as "1M", "10M", etc.
  const millions = Math.floor(num / 1000000);
  const remainder = num % 1000000;
  
  // If there's a significant remainder, show one decimal place
  if (remainder >= 100000) {
    return `${(num / 1000000).toFixed(1)}M`;
  } else {
    return `${millions}M`;
  }
};

/**
 * Format credits specifically (includes logic for admin infinite credits)
 * @param credits - The credit amount
 * @param userRole - The user's role
 * @returns Formatted credit string
 */
export const formatCredits = (credits: number | undefined | null, userRole?: string): string => {
  const isAdmin = userRole === 'administrator';
  return formatLargeNumber(credits, isAdmin);
};

/**
 * Format review count
 * @param count - The review count
 * @returns Formatted review count string
 */
export const formatReviewCount = (count: number | undefined | null): string => {
  return formatLargeNumber(count, false);
};

/**
 * Format general statistics (for admin dashboard, etc.)
 * @param stat - The statistic number
 * @returns Formatted statistic string
 */
export const formatStat = (stat: number | undefined | null): string => {
  return formatLargeNumber(stat, false);
};