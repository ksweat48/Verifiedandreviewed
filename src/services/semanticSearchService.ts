import { supabase } from './supabaseClient';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';

export interface OfferingSearchResult {
  offeringId: string;
  businessId: string;
  offeringTitle: string;
  offeringImageUrl: string;
  offeringType: string;
  businessName: string;
  businessAddress?: string;
  distance?: number;
  duration?: number;
  businessRating?: number;
  isOpen?: boolean;
  similarity?: number;
}

export interface BusinessSearchResult {
  id: string;
  name: string;
  image?: string;
  shortDescription?: string;
  rating?: number;
  distance?: number;
  duration?: number;
  isOpen?: boolean;
  similarity?: number;
}

export class SemanticSearchService {
  // Check if offering search is available
  static async isOfferingSearchAvailable(): Promise<boolean> {
    try {
      const response = await fetchWithTimeout('/.netlify/functions/search-offerings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: 'test',
          checkAvailability: true
        }),
      }, 5000);
      
      const data = await response.json();
      return data.available === true;
    } catch (error) {
      console.error('Error checking offering search availability:', error);
      return false;
    }
  }

  // New method for searching offerings
  static async searchOfferingsByVibe(
    query: string,
    latitude?: number,
    longitude?: number
  ): Promise<OfferingSearchResult[]> {
    try {
      const response = await fetchWithTimeout('/.netlify/functions/search-offerings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query.trim(),
          latitude,
          longitude
        }),
      }, 30000);
      
      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Search failed');
      }
      
      return data.results || [];
    } catch (error) {
      console.error('Offering search failed:', error);
      throw error;
    }
  }

  // Renamed existing method for clarity
  static async searchBusinessesByVibe(
    query: string,
    latitude?: number,
    longitude?: number
  ): Promise<BusinessSearchResult[]> {
    try {
      const response = await fetchWithTimeout('/.netlify/functions/semantic-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query.trim(),
          latitude,
          longitude
        }),
      }, 30000);
      
      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Search failed');
      }
      
      return data.results || [];
    } catch (error) {
      console.error('Business search failed:', error);
      throw error;
    }
  }
}