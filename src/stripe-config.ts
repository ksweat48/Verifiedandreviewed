export interface StripeProduct {
  id: string;
  priceId: string;
  name: string;
  description: string;
  mode: 'payment' | 'subscription';
  price: number;
  credits: number;
  isPopular?: boolean;
  discount?: {
    percentage: number;
    label: string;
  };
}

export const STRIPE_PRODUCTS: StripeProduct[] = [
  {
    id: 'prod_SoIF7EkMZBHbj8',
    priceId: 'price_1Rsff2FlRLh9T0clI9xCzibp',
    name: 'Starter Pack',
    description: 'Get 250 Credits = to 125 more searches on Verified & Reviewed.',
    mode: 'payment',
    price: 2.99,
    credits: 250
  },
  {
    id: 'prod_SoIHnieXBxZh5Z',
    priceId: 'price_1Rsfh5FlRLh9T0clSfnxrduh',
    name: 'Standard Pack',
    description: 'Get 500 credits for 250 more searches on Verified & Reviewed.',
    mode: 'payment',
    price: 5.99,
    credits: 500
  },
  {
    id: 'prod_SoIIkMtt431USr',
    priceId: 'price_1Rsfi5FlRLh9T0clrZTreccv',
    name: 'Best Value Pack',
    description: 'Get 1000 credits for 500 searches',
    mode: 'payment',
    price: 8.99,
    credits: 1000,
    isPopular: true,
    discount: {
      percentage: 25,
      label: 'Save 25%'
    }
  },
  {
    id: 'prod_SoIJcWICzkFwjV',
    priceId: 'price_1Rsfj0FlRLh9T0clkVAa98ek',
    name: 'Power User Pack',
    description: 'Get 2000',
    mode: 'payment',
    price: 14.99,
    credits: 2000,
    discount: {
      percentage: 40,
      label: 'Save 40%'
    }
  }
];

export const getProductByPriceId = (priceId: string): StripeProduct | undefined => {
  return STRIPE_PRODUCTS.find(product => product.priceId === priceId);
};

export const getProductById = (id: string): StripeProduct | undefined => {
  return STRIPE_PRODUCTS.find(product => product.id === id);
};