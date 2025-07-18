import { useState, useEffect } from 'react';
import type { WordPressPost, WordPressCategory } from '../types/wordpress';

export const useWordPressPosts = (params?: {
  per_page?: number;
  page?: number;
  categories?: string;
  search?: string;
}) => {
  const [posts, setPosts] = useState<WordPressPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);

  // Lazy load the WordPressService to reduce initial bundle size
  const getWordPressService = async () => {
    const { WordPressService } = await import('../services/wordpress');
    return WordPressService;
  };

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const WordPressService = await getWordPressService();
        const result = await WordPressService.getPosts(params);
        
        setPosts(result.posts);
        setTotalPages(result.totalPages);
        setTotal(result.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch posts');
        
        // Don't set empty posts on error - let the service handle demo data
        setPosts([]);
        setTotalPages(0);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();
  }, [JSON.stringify(params)]);

  return { posts, loading, error, totalPages, total };
};

export const useWordPressCategories = () => {
  const [categories, setCategories] = useState<WordPressCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Lazy load the WordPressService to reduce initial bundle size
  const getWordPressService = async () => {
    const { WordPressService } = await import('../services/wordpress');
    return WordPressService;
  };

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const WordPressService = await getWordPressService();
        const result = await WordPressService.getCategories();
        
        setCategories(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch categories');
        
        // Set empty categories on error
        setCategories([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, []);

  return { categories, loading, error };
};

export const useWordPressPost = (slug: string) => {
  const [post, setPost] = useState<WordPressPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Lazy load the WordPressService to reduce initial bundle size
  const getWordPressService = async () => {
    const { WordPressService } = await import('../services/wordpress');
    return WordPressService;
  };

  useEffect(() => {
    const fetchPost = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const WordPressService = await getWordPressService();
        const result = await WordPressService.getPostBySlug(slug);
        
        setPost(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch post');
        setPost(null);
      } finally {
        setLoading(false);
      }
    };

    if (slug) {
      fetchPost();
    }
  }, [slug]);

  return { post, loading, error };
};