/*
  # Create businesses and related tables

  1. New Tables
    - `businesses`
      - `id` (uuid, primary key)
      - `name` (text)
      - `address` (text)
      - `location` (text)
      - `category` (text)
      - `tags` (text[])
      - `description` (text)
      - `image_url` (text)
      - `gallery_urls` (text[])
      - `hours` (text)
      - `is_verified` (boolean)
      - `thumbs_up` (integer)
      - `thumbs_down` (integer)
      - `sentiment_score` (integer)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    - `business_ratings`
      - `id` (uuid, primary key)
      - `business_id` (uuid, foreign key to businesses)
      - `user_id` (uuid, foreign key to profiles)
      - `is_thumbs_up` (boolean)
      - `created_at` (timestamptz)
    - `business_visits`
      - `id` (uuid, primary key)
      - `business_id` (uuid, foreign key to businesses)
      - `user_id` (uuid, foreign key to profiles)
      - `visited_at` (timestamptz)
  2. Security
    - Enable RLS on all tables
    - Add appropriate policies
*/

-- Create businesses table
CREATE TABLE IF NOT EXISTS businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  location TEXT,
  category TEXT,
  tags TEXT[],
  description TEXT,
  image_url TEXT,
  gallery_urls TEXT[],
  hours TEXT,
  is_verified BOOLEAN DEFAULT false,
  thumbs_up INTEGER DEFAULT 0,
  thumbs_down INTEGER DEFAULT 0,
  sentiment_score INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create business ratings table
CREATE TABLE IF NOT EXISTS business_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  is_thumbs_up BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(business_id, user_id)
);

-- Create business visits table
CREATE TABLE IF NOT EXISTS business_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  visited_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(business_id, user_id)
);

-- Create business recommendations table
CREATE TABLE IF NOT EXISTS business_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  location TEXT,
  category TEXT,
  description TEXT,
  image_url TEXT,
  recommended_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_recommendations ENABLE ROW LEVEL SECURITY;

-- Create policies for businesses
CREATE POLICY "Anyone can read businesses"
  ON businesses
  FOR SELECT
  USING (true);

CREATE POLICY "Service role can create/update businesses"
  ON businesses
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create policies for business ratings
CREATE POLICY "Users can read all ratings"
  ON business_ratings
  FOR SELECT
  USING (true);

CREATE POLICY "Users can create their own ratings"
  ON business_ratings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own ratings"
  ON business_ratings
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create policies for business visits
CREATE POLICY "Users can read their own visits"
  ON business_visits
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own visits"
  ON business_visits
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create policies for business recommendations
CREATE POLICY "Users can read all recommendations"
  ON business_recommendations
  FOR SELECT
  USING (true);

CREATE POLICY "Users can create recommendations"
  ON business_recommendations
  FOR INSERT
  WITH CHECK (auth.uid() = recommended_by OR recommended_by IS NULL);

-- Create function to update business sentiment score
CREATE OR REPLACE FUNCTION public.update_business_sentiment()
RETURNS TRIGGER AS $$
DECLARE
  thumbs_up_count INTEGER;
  thumbs_down_count INTEGER;
  total_ratings INTEGER;
  new_sentiment_score INTEGER;
BEGIN
  -- Get counts
  SELECT 
    COUNT(*) FILTER (WHERE is_thumbs_up = true),
    COUNT(*) FILTER (WHERE is_thumbs_up = false)
  INTO thumbs_up_count, thumbs_down_count
  FROM business_ratings
  WHERE business_id = NEW.business_id;
  
  -- Calculate sentiment score
  total_ratings := thumbs_up_count + thumbs_down_count;
  IF total_ratings > 0 THEN
    new_sentiment_score := (thumbs_up_count::float / total_ratings::float * 100)::integer;
  ELSE
    new_sentiment_score := 0;
  END IF;
  
  -- Update business
  UPDATE businesses
  SET 
    thumbs_up = thumbs_up_count,
    thumbs_down = thumbs_down_count,
    sentiment_score = new_sentiment_score,
    updated_at = now()
  WHERE id = NEW.business_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for business sentiment update
CREATE OR REPLACE TRIGGER on_business_rating_change
  AFTER INSERT OR UPDATE ON business_ratings
  FOR EACH ROW EXECUTE FUNCTION public.update_business_sentiment();