export interface WordPressPost {
  id: number;
  date: string;
  date_gmt: string;
  guid: {
    rendered: string;
  };
  modified: string;
  modified_gmt: string;
  slug: string;
  status: string;
  type: string;
  link: string;
  title: {
    rendered: string;
  };
  content: {
    rendered: string;
    protected: boolean;
  };
  excerpt: {
    rendered: string;
    protected: boolean;
  };
  author: number;
  featured_media: number;
  comment_status: string;
  ping_status: string;
  sticky: boolean;
  template: string;
  format: string;
  meta: any;
  categories: number[];
  tags: number[];
  acf?: {
    business_name?: string;
    location?: string;
    health_score?: number;
    rating?: number;
    category?: string;
    features?: string[];
    verified_date?: string;
    review_text?: string;
    business_image?: string;
    clean_bathrooms?: boolean;
    drive_thru?: boolean;
    black_owned?: boolean;
    women_owned?: boolean;
    veteran_owned?: boolean;
    vegan_options?: boolean;
    health_score_90_plus?: boolean;
    is_verified?: boolean;
    // Gallery images (up to 5)
    gallery_image_1?: string;
    gallery_image_2?: string;
    gallery_image_3?: string;
    gallery_image_4?: string;
    gallery_image_5?: string;
  };
  _embedded?: {
    'wp:featuredmedia'?: Array<{
      id: number;
      source_url: string;
      alt_text: string;
    }>;
    'wp:term'?: Array<Array<{
      id: number;
      name: string;
      slug: string;
    }>>;
  };
}

export interface WordPressCategory {
  id: number;
  count: number;
  description: string;
  link: string;
  name: string;
  slug: string;
  taxonomy: string;
  parent: number;
  meta: any;
}

export interface WordPressMedia {
  id: number;
  date: string;
  slug: string;
  type: string;
  link: string;
  title: {
    rendered: string;
  };
  author: number;
  media_type: string;
  mime_type: string;
  media_details: {
    width: number;
    height: number;
    file: string;
    sizes: {
      [key: string]: {
        file: string;
        width: number;
        height: number;
        mime_type: string;
        source_url: string;
      };
    };
  };
  source_url: string;
  alt_text: string;
}