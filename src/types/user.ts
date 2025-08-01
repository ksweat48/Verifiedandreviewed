export interface User {
  id: string;
  username: string;
  username: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'administrator' | 'editor' | 'author' | 'subscriber' | 'user';
  reviewCount: number;
  level: number;
  credits?: number;
  joinDate: string;
  bio?: string;
  status: 'active' | 'inactive';
  lastLogin?: string;
}

export interface ReviewerLevel {
  level: number;
  name: string;
  minReviews: number;
  maxReviews: number;
  benefits: string[];
  color: string;
}

export const REVIEWER_LEVELS: ReviewerLevel[] = [
  {
    level: 1,
    name: 'New Reviewer',
    minReviews: 0,
    maxReviews: 9,
    benefits: ['Submit reviews', 'Basic profile'],
    color: 'gray'
  },
  {
    level: 2,
    name: 'Regular Reviewer',
    minReviews: 10,
    maxReviews: 19,
    benefits: ['Priority review processing', 'Profile badge'],
    color: 'blue'
  },
  {
    level: 3,
    name: 'Trusted Reviewer',
    minReviews: 20,
    maxReviews: 29,
    benefits: ['Featured in Popular Reviews', 'Early access to features'],
    color: 'green'
  },
  {
    level: 4,
    name: 'Expert Reviewer',
    minReviews: 30,
    maxReviews: 49,
    benefits: ['Verification priority', 'Special recognition'],
    color: 'purple'
  },
  {
    level: 5,
    name: 'Master Reviewer',
    minReviews: 50,
    maxReviews: Infinity,
    benefits: ['Top priority', 'Exclusive events', 'Direct admin contact'],
    color: 'yellow'
  }
];

export const getUserLevel = (reviewCount: number): ReviewerLevel => {
  return REVIEWER_LEVELS.find(level => 
    reviewCount >= level.minReviews && reviewCount <= level.maxReviews
  ) || REVIEWER_LEVELS[0];
};