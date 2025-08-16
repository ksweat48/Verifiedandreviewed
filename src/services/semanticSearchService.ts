// Semantic Search Service for Vibe-Based Business Discovery
import { fetchWithTimeout } from '../utils/fetchWithTimeout';

export class SemanticSearchService {
  // Perform unified search using the new endpoint
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
      offerings: number;
      platform_businesses: number;
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
        timeout: 25000 // 25 second timeout for unified search
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

  // Generate embeddings for businesses and offerings (admin function)
  static async generateEmbeddings(options: {
    businessId?: string;
    batchSize?: number;
    forceRegenerate?: boolean;
  } = {}): Promise<{
    success: boolean;
    processed: number;
    successCount: number;
    errorCount: number;
    message: string;
  }> {
    try {
      console.log('🔄 Starting embedding generation...', options.businessId ? `for business ${options.businessId}` : 'batch mode');

      const response = await fetchWithTimeout('/.netlify/functions/generate-embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          businessId: options.businessId,
          batchSize: options.batchSize || 10,
          forceRegenerate: options.forceRegenerate || false
        }),
        timeout: 30000 // 30 second timeout for embedding generation (longer process)
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch (jsonError) {
          console.error('Failed to parse error response:', jsonError);
        }
        throw new Error(errorMessage);
      }

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error('Failed to parse embedding generation response:', jsonError);
        throw new Error('Invalid response from embedding generation service');
      }
      
      console.log('✅ Embedding generation completed:', data.message);

      return {
        success: data.success,
        processed: data.processed || 0,
        successCount: data.successCount || 0,
        errorCount: data.errorCount || 0,
        message: data.message
      };

    } catch (error) {
      console.error('❌ Embedding generation error:', error);
      
      return {
        success: false,
        processed: 0,
        successCount: 0,
        errorCount: 0,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}