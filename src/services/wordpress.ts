import axios from 'axios';
import type { WordPressPost, WordPressCategory, WordPressMedia } from '../types/wordpress';

// Create API instance lazily to avoid unnecessary initialization
const getApiInstance = () => {
  const WORDPRESS_API_URL = import.meta.env.VITE_WORDPRESS_API_URL || 'https://cms.verifiedandreviewed.com/wp-json/wp/v2';
  
  return axios.create({
    baseURL: WORDPRESS_API_URL,
    timeout: 15000,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  });
};

export class WordPressService {
  // Check if WordPress is available
  static async isWordPressAvailable(): Promise<boolean> {
    try {
      const api = getApiInstance();
      const response = await api.get('/posts', { 
        params: { per_page: 1 }, 
        timeout: 8000 
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  // Get all posts with optional filters
  static async getPosts(params?: {
    per_page?: number;
    page?: number;
    categories?: string;
    tags?: string;
    search?: string;
    orderby?: string;
    order?: 'asc' | 'desc';
  }): Promise<{ posts: WordPressPost[]; totalPages: number; total: number }> {
    try {
      const api = getApiInstance();
      const response = await api.get('/posts', {
        params: {
          _embed: true, // Include featured media and other embedded data
          per_page: 10, // Default
          orderby: 'date',
          order: 'desc',
          ...params,
        },
      });

      return {
        posts: response.data,
        totalPages: parseInt(response.headers['x-wp-totalpages'] || '1', 10),
        total: parseInt(response.headers['x-wp-total'] || '0', 10),
      };
    } catch (error) {
      return {
        posts: this.getDemoData(),
        totalPages: 1,
        total: 3,
      };
    }
  }

  // Get demo data when WordPress is not available
  static getDemoData(): WordPressPost[] {
    return []; // Return empty array instead of mock data
  }

  // Get a single post by slug
  static async getPostBySlug(slug: string): Promise<WordPressPost | null> {
    try {
      const api = getApiInstance();
      const response = await api.get('/posts', {
        params: {
          slug,
          _embed: true,
        },
      });
      
      return response.data[0] || null;
    } catch (error) {
      // Return demo post if slug matches
      const mockData = this.getDemoData();
      return mockData.find(post => post.slug === slug) || null;
    }
  }

  // Get posts by category
  static async getPostsByCategory(categorySlug: string, params?: {
    per_page?: number;
    page?: number;
  }): Promise<{ posts: WordPressPost[]; totalPages: number; total: number }> {
    try {
      // First get the category ID
      const api = getApiInstance();
      const categoriesResponse = await api.get('/categories', {
        params: { slug: categorySlug },
      });

      if (categoriesResponse.data.length === 0) {
        return { posts: [], totalPages: 0, total: 0 };
      }

      const categoryId = categoriesResponse.data[0].id;

      return this.getPosts({
        categories: categoryId.toString(),
        ...params,
      });
    } catch (error) {
      return { posts: [], totalPages: 0, total: 0 };
    }
  }

  // Get all categories
  static async getCategories(): Promise<WordPressCategory[]> {
    try {
      const api = getApiInstance();
      const response = await api.get('/categories', {
        params: {
          per_page: 100, // Get all categories
          hide_empty: false, // Show all categories even if empty
        },
      });
      
      return response.data;
    } catch (error) {
      // Return empty array on error
      return [];
    }
  }

  // Get featured media
  static async getMedia(mediaId: number): Promise<WordPressMedia | null> {
    try {
      const api = getApiInstance();
      const response = await api.get(`/media/${mediaId}`);
      return response.data;
    } catch (error) {
      console.warn('WordPress API error fetching media:', error);
      return null;
    }
  }

  // Search posts
  static async searchPosts(query: string, params?: {
    per_page?: number;
    page?: number;
  }): Promise<{ posts: WordPressPost[]; totalPages: number; total: number }> {
    return this.getPosts({
      search: query,
      ...params,
    });
  }

  // Get posts with custom filters (for your specific use case)
  static async getFilteredReviews(filters: {
    category?: string;
    cleanBathrooms?: boolean;
    healthScore90Plus?: boolean;
    driveThru?: boolean;
    blackOwned?: boolean;
    womenOwned?: boolean;
    veteranOwned?: boolean;
    veganOptions?: boolean;
    location?: string;
    minRating?: number;
  }): Promise<WordPressPost[]> {
    try {
      let posts: WordPressPost[] = [];

      // Start with category filter if provided
      if (filters.category) {
        const result = await this.getPostsByCategory(filters.category, { per_page: 100 });
        posts = result.posts;
      } else {
        const result = await this.getPosts({ per_page: 100 });
        posts = result.posts;
      }

      // Apply custom field filters
      return posts.filter(post => {
        const acf = post.acf;
        if (!acf) return true;

        // Apply filters based on ACF fields
        if (filters.cleanBathrooms && !acf.clean_bathrooms) return false;
        if (filters.healthScore90Plus && (!acf.health_score || acf.health_score < 90)) return false;
        if (filters.driveThru && !acf.drive_thru) return false;
        if (filters.blackOwned && !acf.black_owned) return false;
        if (filters.womenOwned && !acf.women_owned) return false;
        if (filters.veteranOwned && !acf.veteran_owned) return false;
        if (filters.veganOptions && !acf.vegan_options) return false;
        if (filters.location && acf.location && !acf.location.toLowerCase().includes(filters.location.toLowerCase())) return false;
        if (filters.minRating && acf.rating && acf.rating < filters.minRating) return false;

        return true;
      });
    } catch (error) {
      console.warn('WordPress API error:', error);
      return [];
    }
  }
}