// Feature flags for search system migration
// These flags control which search mechanism is active

// Service-First Search (new system)
export const SEARCH_SERVICE_FIRST = false;

// Legacy Search (old system)
export const SEARCH_LEGACY = true;

// Search configuration
export const SEARCH_CONFIG = {
  // Maximum results to return from service-first search
  MAX_RESULTS: 7,
  
  // Embedding model for OpenAI
  EMBEDDING_MODEL: 'text-embedding-3-small',
  
  // Cache duration for search results (seconds)
  CACHE_DURATION: 120,
  
  // KNN candidate limit for performance
  KNN_CANDIDATE_LIMIT: 100
} as const;