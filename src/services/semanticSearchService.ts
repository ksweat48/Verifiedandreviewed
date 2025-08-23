// New Unified Search Service for Platform Offerings and AI Business Offerings
import { fetchWithTimeout } from '../utils/fetchWithTimeout';

export class SemanticSearchService {
  // Perform unified search combining platform offerings and AI businesses
  static async searchByVibe(
    query: string,
    options: {
      latitude?: number;
      longitude?: number;
      matchThreshold?: number;
      matchCount?: number;
    } = {}
  ): Promise<{
    success: boolean;
    results: any[];
    query: string;
    usedUnifiedSearch: boolean;
    searchSources?: {
      platform_offerings: number;
      ai_generated: number;
    };
    error?: string;
  }> {
    try {
      console.log('🔍 Performing unified search for:', query);

      const response = await fetchWithTimeout('/.netlify/functions/unified-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query.trim(),
          latitude: options.latitude,
          longitude: options.longitude,
          matchThreshold: options.matchThreshold || 0.3,
          matchCount: options.matchCount || 15
        }),
        timeout: 25000
      });

      if (!response.ok) {
        if (response.status === 404) {
          return {
            success: false,
            results: [],
            query,
            usedUnifiedSearch: false,
            error: 'Unified search service not available. Make sure to run "netlify dev" instead of "npm run dev".'
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
          usedUnifiedSearch: false,
          error: errorMessage
        };
      }

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error('Failed to parse unified search response:', jsonError);
        throw new Error('Invalid response from unified search service');
      }
      
      if (!data.success) {
        throw new Error(data.message || 'Unified search failed');
      }

      console.log('✅ Unified search completed:', data.matchCount, 'results');
      console.log('📊 Search sources:', data.searchSources);

      return {
        success: true,
        results: data.results || [],
        query: data.query,
        usedUnifiedSearch: true,
        searchSources: data.searchSources
      };

    } catch (error) {
      console.error('❌ Unified search error:', error);
      
      return {
        success: false,
        results: [],
        query,
        usedUnifiedSearch: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}