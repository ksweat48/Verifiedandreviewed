// Utility functions for health scores and sentiment ratings
export const getHealthScoreColor = (score: number) => {
  if (score >= 90) return { bg: 'bg-green-500', text: 'text-green-700', bgLight: 'bg-green-100' };
  if (score >= 70) return { bg: 'bg-yellow-500', text: 'text-yellow-700', bgLight: 'bg-yellow-100' };
  if (score >= 50) return { bg: 'bg-red-500', text: 'text-red-700', bgLight: 'bg-red-100' };
  return { bg: 'bg-gray-800', text: 'text-gray-700', bgLight: 'bg-gray-100' };
};

export const getHealthScoreDescription = (score: number) => {
  if (score >= 90) return 'Exceptionally clean & health-forward';
  if (score >= 70) return 'Adequate but with room for improvement';
  if (score >= 50) return 'Significant issues (not seal-eligible)';
  return 'May be listed publicly as not recommended';
};

export const getHealthScoreIcon = (score: number) => {
  if (score >= 90) return '✅';
  if (score >= 70) return '⚠️';
  if (score >= 50) return '🔴';
  return '🚫';
};

export const getSentimentRating = (score: number) => {
  if (score >= 80) return { text: 'Great', color: 'bg-green-500' };
  if (score >= 70) return { text: 'Good', color: 'bg-blue-500' };
  if (score >= 65) return { text: 'Fair', color: 'bg-yellow-500' };
  return { text: 'Improve', color: 'bg-red-500' };
};