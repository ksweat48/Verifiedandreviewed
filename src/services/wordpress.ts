import axios from 'axios';
import type { WordPressPost, WordPressCategory } from '../types/wordpress';

const WORDPRESS_API_URL = import.meta.env.VITE_WORDPRESS_API_URL || 'https://cms.verifiedandreviewed.com/wp-json/wp/v2';

const apiInstance = axios.create({
  baseURL: WORDPRESS_API_URL,
  timeout: 15000,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
});

export class WordPressService {
  static async isWordPressAvailable(): Promise<boolean> {
    try {
      await apiInstance.get('/posts', { params: { per_page: 1 }, timeout: 8000 });
      return true;
    } catch (error) {
      return false;
    }
  }

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
      const response = await apiInstance.get('/posts', {
        params: {
          _embed: true,
          per_page: 10,
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
      return { posts: [], totalPages: 1, total: 0 };
    }
  }

  static async getPostBySlug(slug: string): Promise<WordPressPost | null> {
    try {
      const response = await apiInstance.get('/posts', {
        params: { slug, _embed: true },
      });
      return response.data[0] || null;
    } catch (error) {
      return null;
    }
  }

  static async getCategories(): Promise<WordPressCategory[]> {
    try {
      const response = await apiInstance.get('/categories', {
        params: { per_page: 100, hide_empty: false },
      });
      return response.data;
    } catch (error) {
      return [];
    }
  }
}