import { fetchWithTimeout } from '../utils/fetchWithTimeout';

export class SemanticSearchService {
  // Generate embeddings for a business
  static async generateEmbeddings(params: { businessId: string }): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await fetchWithTimeout('/.netlify/functions/generate-embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(params),
        timeout: 30000
      });

      if (!response.ok) {
        if (response.status === 404) {
          console.warn('Embedding generation service not available in current environment. Run "netlify dev" to enable Netlify Functions.');
          return { success: false, message: 'Service not available' };
        }
        
        let errorMessage = 'Embedding generation failed';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch (jsonError) {
          console.error('Failed to parse error response:', jsonError);
          errorMessage = `Embedding service error (${response.status})`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error generating embeddings:', error);
      return { success: false, message: error instanceof Error ? error.message : 'Failed to generate embeddings' };
    }
  }

  // Search businesses by vibe using semantic search
  static async searchBusinessesByVibe(params: {
    query: string;
    latitude?: number;
    longitude?: number;
    limit?: number;
  }): Promise<{ success: boolean; results?: any[]; error?: string }> {
    try {
      const response = await fetchWithTimeout('/.netlify/functions/semantic-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(params),
        timeout: 30000
      });

      if (!response.ok) {
        if (response.status === 404) {
          console.warn('Semantic search service not available in current environment. Run "netlify dev" to enable Netlify Functions.');
          return { success: false, error: 'Service not available' };
        }
        
        let errorMessage = 'Semantic search failed';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch (jsonError) {
          console.error('Failed to parse error response:', jsonError);
          errorMessage = `Semantic search service error (${response.status})`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error in semantic search:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to search businesses' };
    }
  }

  // AI business search using OpenAI and Google Places
  static async aiBusinessSearch(params: {
    prompt: string;
    searchQuery?: string;
    existingResultsCount?: number;
    numToGenerate?: number;
    latitude?: number;
    longitude?: number;
  }): Promise<{ success: boolean; results?: any[]; error?: string }> {
    try {
      const response = await fetchWithTimeout('/.netlify/functions/ai-business-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(params),
        timeout: 45000
      });

      if (!response.ok) {
        if (response.status === 404) {
          console.warn('AI business search service not available in current environment. Run "netlify dev" to enable Netlify Functions.');
          return { success: false, error: 'Service not available' };
        }
        
        let errorMessage = 'AI business search failed';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch (jsonError) {
          console.error('Failed to parse error response:', jsonError);
          errorMessage = `AI business search service error (${response.status})`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error in AI business search:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to search businesses with AI' };
    }
  }
}