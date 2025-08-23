


// Search configuration
export const SEARCH_CONFIG = {
  // Maximum results to return from unified search
  MAX_RESULTS: 7,
  
  // Embedding model for OpenAI
  EMBEDDING_MODEL: 'text-embedding-3-small',
  
  // Cache duration for search results (seconds)
  CACHE_DURATION: 120,
  
  // KNN candidate limit for performance
  KNN_CANDIDATE_LIMIT: 100
} as const;