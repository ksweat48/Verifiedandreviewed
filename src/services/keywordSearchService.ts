// Keyword-based search service for precise offering matching
import { fetchWithTimeout } from '../utils/fetchWithTimeout';

export class KeywordSearchService {
  // Perform keyword-based search for offerings
  static async searchOfferings(
    query: string,
    options: {
      latitude?: number;
      longitude?: number;
      matchCount?: number;
    } = {}
  ): Promise<{
    success: boolean;
    results: any[];
    query: string;
    keywords: string[];
    usedKeywordSearch: boolean;
    error?: string;
  }> {
    try {
      console.log('🔍 Performing keyword search for:', query);

      const response = await fetchWithTimeout('/.netlify/functions/keyword-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query.trim(),
          latitude: options.latitude,
          longitude: options.longitude,
          matchCount: options.matchCount || 10
        }),
        timeout: 20000
      });

      if (!response.ok) {
        if (response.status === 404) {
          return {
            success: false,
            results: [],
            query,
            keywords: [],
            usedKeywordSearch: false,
            error: 'Keyword search service not available. Make sure to run "netlify dev" instead of "npm run dev".'
          };
        }
        
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch (jsonError) {
          console.error('Failed to parse error response:', jsonError);
        }
        
        return {
          success: false,
          results: [],
          query,
          keywords: [],
          usedKeywordSearch: false,
          error: errorMessage
        };
      }

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error('Failed to parse keyword search response:', jsonError);
        throw new Error('Invalid response from keyword search service');
      }
      
      if (!data.success) {
        throw new Error(data.message || 'Keyword search failed');
      }

      console.log('✅ Keyword search completed:', data.matchCount, 'results');
      console.log('🔍 Keywords used:', data.keywords);

      return {
        success: true,
        results: data.results || [],
        query: data.query,
        keywords: data.keywords || [],
        usedKeywordSearch: true
      };

    } catch (error) {
      console.error('❌ Keyword search error:', error);
      
      return {
        success: false,
        results: [],
        query,
        keywords: [],
        usedKeywordSearch: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}