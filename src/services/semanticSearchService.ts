import { fetchWithTimeout } from '../utils/fetchWithTimeout';

export interface OfferingSearchResult {
  offeringId: string;
  businessId: string;
  offeringTitle: string;
  offeringDescription?: string;
  offeringImageUrl: string;
  offeringType: string;
  businessName: string;
  businessAddress?: string;
  businessLatitude?: number;
  businessLongitude?: number;
  businessHours?: string;
  businessPhone?: string;
  businessWebsite?: string;
  isOpen?: boolean;
  distance?: number;
  duration?: number;
  similarity: number;
  businessRating?: {
    thumbsUp: number;
    thumbsDown: number;
    sentimentScore: number;
  };
}

export class SemanticSearchService {
  // Check if offering search is available
  static async isOfferingSearchAvailable(): Promise<boolean> {
    try {
      const response = await fetchWithTimeout('/.netlify/functions/search-offerings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: 'test',
          latitude: 0,
          longitude: 0,
          matchCount: 1
        }),
        timeout: 5000
      });
      
      return response.ok;
    } catch (error) {
      console.warn('Offering search not available:', error);
      return false;
    }
  }

  // Search for offerings by vibe/semantic similarity
  static async searchOfferingsByVibe(
    query: string,
    latitude?: number,
    longitude?: number,
    matchThreshold: number = 0.3,
    matchCount: number = 7
  ): Promise<OfferingSearchResult[]> {
    try {
      const response = await fetchWithTimeout('/.netlify/functions/search-offerings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query,
          latitude,
          longitude,
          matchThreshold,
          matchCount
        }),
        timeout: 30000
      });

      if (!response.ok) {
        throw new Error(`Offering search failed: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        return data.results || [];
      } else {
        throw new Error(data.message || 'Offering search failed');
      }
    } catch (error) {
      console.error('Error in offering search:', error);
      return [];
    }
  }

  // Search for businesses by vibe/semantic similarity
  static async searchBusinessesByVibe(
    query: string,
    latitude?: number,
    longitude?: number,
    matchThreshold: number = 0.5,
    matchCount: number = 10
  ): Promise<any[]> {
    try {
      const response = await fetchWithTimeout('/.netlify/functions/semantic-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query,
          latitude,
          longitude,
          matchThreshold,
          matchCount
        }),
        timeout: 30000
      });

      if (!response.ok) {
        throw new Error(`Semantic search failed: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        return data.results || [];
      } else {
        throw new Error(data.message || 'Semantic search failed');
      }
    } catch (error) {
      console.error('Error in semantic search:', error);
      return [];
    }
  }

  // Generate embeddings for businesses
  static async generateEmbeddings(params: {
    businessId?: string;
    batchSize?: number;
    forceRegenerate?: boolean;
  } = {}): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await fetchWithTimeout('/.netlify/functions/generate-embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(params),
        timeout: 60000
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Embedding generation failed');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error generating embeddings:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Embedding generation failed'
      };
    }
  }
}