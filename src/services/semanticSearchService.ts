// Semantic Search Service for Vibe-Based Business Discovery
export class SemanticSearchService {
  // Perform semantic search using vector embeddings
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
    usedSemanticSearch: boolean;
    error?: string;
  }> {
    try {
      console.log('🔍 Performing semantic search for:', query);

      const response = await fetch('/.netlify/functions/semantic-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query.trim(),
          latitude: options.latitude,
          longitude: options.longitude,
          matchThreshold: options.matchThreshold || 0.7,
          matchCount: options.matchCount || 10
        })
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Semantic search service not available. The semantic-search Netlify Function may not be deployed or running. If developing locally, make sure to run "netlify dev" instead of "npm run dev".');
        }
        
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch (jsonError) {
          console.error('Failed to parse error response:', jsonError);
          errorMessage = `Semantic search service error (${response.status})`;
        }
        throw new Error(errorMessage);
      }

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error('Failed to parse semantic search response:', jsonError);
        throw new Error('Invalid response from semantic search service');
      }
      
      if (!data.success) {
        throw new Error(data.message || 'Semantic search failed');
      }

      console.log('✅ Semantic search completed:', data.matchCount, 'results');

      return {
        success: true,
        results: data.results || [],
        query: data.query,
        usedSemanticSearch: true
      };

    } catch (error) {
      console.error('❌ Semantic search error:', error);
      
      return {
        success: false,
        results: [],
        query,
        usedSemanticSearch: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Generate embeddings for existing businesses (admin function)
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

      const response = await fetch('/.netlify/functions/generate-embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          businessId: options.businessId,
          batchSize: options.batchSize || 10,
          forceRegenerate: options.forceRegenerate || false
        })
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

  // Check if semantic search is available
  static async isSemanticSearchAvailable(): Promise<boolean> {
    try {
      const response = await fetch('/.netlify/functions/semantic-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: 'test'
        })
      });

      // Even if the search fails, if we get a response, the function is available
      return response.status !== 404;
    } catch (error) {
      return false;
    }
  }
}