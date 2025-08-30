import { UserService } from './userService';
import { supabase } from './supabaseClient';

export interface CreditTransaction {
  id: string;
  userId: string;
  amount: number;
  type: 'search' | 'ai-search' | 'review-reward' | 'referral-reward' | 'monthly-refill' | 'purchase' | 'signup-bonus';
  description: string;
  timestamp: string;
}

export class CreditService {
  // Deduct credits for a search
  static async deductSearchCredits(userId: string, searchType: 'platform' | 'ai' | 'semantic'): Promise<boolean> {
    try {
      const creditsToDeduct = 2; // All searches cost 2 credits regardless of type
      
      // Call the secure credit deduction function
      const response = await fetch('/.netlify/functions/deduct-credits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userId,
          amount: creditsToDeduct,
          type: 'search',
          description: `${searchType.charAt(0).toUpperCase() + searchType.slice(1)} search`
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Credit deduction failed:', errorData);
        return false;
      }

      const result = await response.json();
      console.log('✅ Credit deduction successful:', result);
      return result.success;
      
    } catch (error) {
      console.error('Error deducting credits:', error);
      return false;
    }
  }
  
  // Add credits for a review
  static async addReviewCredits(userId: string, reviewData: {
    hasRating: boolean;
    photoCount: number;
    hasText: boolean;
  }): Promise<boolean> {
    try {
      // Check if review meets criteria
      if (!reviewData.hasRating || reviewData.photoCount < 3 || !reviewData.hasText) {
        return false; // Review doesn't qualify for credits
      }
      
      const user = await UserService.getCurrentUser();
      if (!user) return false;
      
      // In a real app, this would call an API to update the user's credits
      const updatedUser = await UserService.updateUser(userId, {
        credits: (user.credits || 0) + 2
      });
      
      // Log transaction
      this.logTransaction({
        id: Date.now().toString(),
        userId,
        amount: 2,
        type: 'review-reward',
        description: 'Credits for submitting a review',
        timestamp: new Date().toISOString()
      });
      
      return updatedUser.success;
    } catch (error) {
      console.error('Error adding review credits:', error);
      return false;
    }
  }
  
  // Add referral credits
  static async addReferralCredits(userId: string, referredUserId: string): Promise<boolean> {
    try {
      // Check if this referral has already been rewarded
      const hasBeenRewarded = this.checkReferralRewarded(userId, referredUserId);
      if (hasBeenRewarded) return false;
      
      const user = await UserService.getCurrentUser();
      if (!user) return false;
      
      // In a real app, this would call an API to update the user's credits
      const updatedUser = await UserService.updateUser(userId, {
        credits: (user.credits || 0) + 20
      });
      
      // Log transaction
      this.logTransaction({
        id: Date.now().toString(),
        userId,
        amount: 20,
        type: 'referral-reward',
        description: 'Referral bonus',
        timestamp: new Date().toISOString()
      });
      
      // Mark this referral as rewarded
      this.markReferralRewarded(userId, referredUserId);
      
      return updatedUser.success;
    } catch (error) {
      console.error('Error adding referral credits:', error);
      return false;
    }
  }
  
  // Add monthly free credits
  static async addMonthlyFreeCredits(userId: string): Promise<boolean> {
    try {
      const user = await UserService.getCurrentUser();
      if (!user) return false;
      
      // In a real app, this would call an API to update the user's credits
      const updatedUser = await UserService.updateUser(userId, {
        credits: (user.credits || 0) + 50
      });
      
      // Log transaction
      this.logTransaction({
        id: Date.now().toString(),
        userId,
        amount: 50,
        type: 'monthly-refill',
        description: 'Monthly free credits',
        timestamp: new Date().toISOString()
      });
      
      // Update next refill date in localStorage
      const nextRefillDate = new Date();
      nextRefillDate.setMonth(nextRefillDate.getMonth() + 1);
      localStorage.setItem(`next_refill_${userId}`, nextRefillDate.toISOString());
      
      return updatedUser.success;
    } catch (error) {
      console.error('Error adding monthly credits:', error);
      return false;
    }
  }
  
  // Add signup bonus credits
  static async addSignupBonusCredits(userId: string): Promise<boolean> {
    try {
      const user = await UserService.getCurrentUser();
      if (!user) return false;
      
      // If user is an administrator, skip credit management
      if (user.role === 'administrator') {
        return true;
      }
     
      // In a real app, this would call an API to update the user's credits
      const updatedUser = await UserService.updateUser(userId, {
        credits: (user.credits || 0) + 100
      });
      
      // Log transaction
      this.logTransaction({
        id: Date.now().toString(),
        userId,
        amount: 100,
        type: 'signup-bonus',
        description: 'Signup bonus',
        timestamp: new Date().toISOString()
      });
      
      // Set initial refill date
      const nextRefillDate = new Date();
      nextRefillDate.setMonth(nextRefillDate.getMonth() + 1);
      localStorage.setItem(`next_refill_${userId}`, nextRefillDate.toISOString());
      
      return updatedUser.success;
    } catch (error) {
      console.error('Error adding signup bonus credits:', error);
      return false;
    }
  }
  
  // Purchase credits
  static async purchaseCredits(userId: string, packageId: string, withAutoRefill: boolean): Promise<boolean> {
    try {
      const user = await UserService.getCurrentUser();
      if (!user) return false;
      
      // Get package details
      const packages = {
        'starter': { credits: 250, price: 2.99 },
        'standard': { credits: 500, price: 5.99 },
        'best-value': { credits: 1000, price: 8.99 },
        'power-user': { credits: 2000, price: 14.99 }
      };
      
      const selectedPackage = packages[packageId as keyof typeof packages];
      if (!selectedPackage) return false;
      
      // Calculate bonus for auto-refill
      const bonusCredits = withAutoRefill ? Math.round(selectedPackage.credits * 0.1) : 0;
      const totalCredits = selectedPackage.credits + bonusCredits;
      
      // In a real app, this would call an API to process payment and update credits
      const updatedUser = await UserService.updateUser(userId, {
        credits: (user.credits || 0) + totalCredits
      });
      
      // Log transaction
      this.logTransaction({
        id: Date.now().toString(),
        userId,
        amount: totalCredits,
        type: 'purchase',
        description: `Purchased ${selectedPackage.credits} credits${bonusCredits > 0 ? ` + ${bonusCredits} bonus` : ''}`,
        timestamp: new Date().toISOString()
      });
      
      // Save auto-refill preference
      if (withAutoRefill) {
        localStorage.setItem(`auto_refill_${userId}`, packageId);
      } else {
        localStorage.removeItem(`auto_refill_${userId}`);
      }
      
      return updatedUser.success;
    } catch (error) {
      console.error('Error purchasing credits:', error);
      return false;
    }
  }
  
  // Get next refill date
  static getNextRefillDate(userId: string): Date | null {
    const nextRefillDateStr = localStorage.getItem(`next_refill_${userId}`);
    return nextRefillDateStr ? new Date(nextRefillDateStr) : null;
  }
  
  // Check if user has auto-refill enabled
  static hasAutoRefill(userId: string): { enabled: boolean; packageId: string | null } {
    const packageId = localStorage.getItem(`auto_refill_${userId}`);
    return {
      enabled: !!packageId,
      packageId
    };
  }
  
  // Get credit transaction history
  static getTransactionHistory(userId: string): CreditTransaction[] {
    const historyStr = localStorage.getItem(`credit_history_${userId}`);
    return historyStr ? JSON.parse(historyStr) : [];
  }
  
  // Log a credit transaction
  private static logTransaction(transaction: CreditTransaction): void {
    const history = this.getTransactionHistory(transaction.userId);
    history.unshift(transaction); // Add to beginning of array
    localStorage.setItem(`credit_history_${transaction.userId}`, JSON.stringify(history.slice(0, 50))); // Keep last 50 transactions
  }
  
  // Check if a referral has already been rewarded
  private static checkReferralRewarded(userId: string, referredUserId: string): boolean {
    const rewardedReferrals = localStorage.getItem(`rewarded_referrals_${userId}`);
    if (!rewardedReferrals) return false;
    
    const referrals = JSON.parse(rewardedReferrals) as string[];
    return referrals.includes(referredUserId);
  }
  
  // Mark a referral as rewarded
  private static markReferralRewarded(userId: string, referredUserId: string): void {
    const rewardedReferralsStr = localStorage.getItem(`rewarded_referrals_${userId}`);
    const rewardedReferrals = rewardedReferralsStr ? JSON.parse(rewardedReferralsStr) as string[] : [];
    
    if (!rewardedReferrals.includes(referredUserId)) {
      rewardedReferrals.push(referredUserId);
      localStorage.setItem(`rewarded_referrals_${userId}`, JSON.stringify(rewardedReferrals));
    }
  }
  
  // Check if user has enough credits for a search
  static hasEnoughCreditsForSearch(userId: string, searchType: 'platform' | 'ai' | 'semantic' | 'keyword'): Promise<boolean> {
    return new Promise(async (resolve) => {
      const user = await UserService.getCurrentUser();
      if (!user) {
        resolve(false);
        return;
      }
      
     // Administrators always have enough credits
     if (user.role === 'administrator') {
       resolve(true);
       return;
     }
     
      const requiredCredits = 2; // All searches now cost 2 credits
      resolve((user.credits || 0) >= requiredCredits);
    });
  }
  
}