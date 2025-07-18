import React, { useState } from 'react';
import { ShoppingCart, ExternalLink, Star } from 'lucide-react';

const VerifiedPicks = () => {
  const [cart, setCart] = useState<number[]>([]);

  const products = [
    {
      id: 1,
      title: "Clean Eating Travel Guide",
      type: "Digital Guide",
      price: "$19.99",
      originalPrice: "$29.99",
      image: "https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=300",
      description: "Complete guide to finding healthy food options while traveling. Includes restaurant recommendations.",
      rating: 4.9,
      reviews: 127,
      downloadUrl: "#"
    },
    {
      id: 2,
      title: "Organic Travel Snack Set",
      type: "Affiliate Product",
      price: "$24.99",
      image: "https://images.pexels.com/photos/1092730/pexels-photo-1092730.jpeg?auto=compress&cs=tinysrgb&w=300",
      description: "Curated selection of organic, non-GMO snacks perfect for road trips and travel.",
      rating: 4.7,
      reviews: 89,
      affiliateUrl: "https://amazon.com/example-product"
    },
    {
      id: 3,
      title: "Hotel Cleanliness Checklist",
      type: "Digital Checklist",
      price: "$9.99",
      image: "https://images.pexels.com/photos/164595/pexels-photo-164595.jpeg?auto=compress&cs=tinysrgb&w=300",
      description: "Professional checklist to evaluate hotel cleanliness standards. Used by industry professionals.",
      rating: 5.0,
      reviews: 45,
      downloadUrl: "#"
    },
    {
      id: 4,
      title: "Portable Water Filter",
      type: "Affiliate Product",
      price: "$34.99",
      originalPrice: "$49.99",
      image: "https://images.pexels.com/photos/1000084/pexels-photo-1000084.jpeg?auto=compress&cs=tinysrgb&w=300",
      description: "Premium portable water filter for clean, safe drinking water anywhere you travel.",
      rating: 4.8,
      reviews: 203,
      affiliateUrl: "https://amazon.com/example-filter"
    }
  ];

  const buyNow = (productId: number) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      if (product.affiliateUrl) {
        window.open(product.affiliateUrl, '_blank', 'noopener,noreferrer');
      } else if (product.downloadUrl) {
        // Handle digital download
        alert('Purchase completed! Download started. (This is a demo - no actual purchase will be made)');
      }
    }
  };

  const handleExternalLink = (product: any) => {
    if (product.affiliateUrl) {
      window.open(product.affiliateUrl, '_blank', 'noopener,noreferrer');
    } else if (product.downloadUrl) {
      // Handle digital download
      alert('Download started! (This is a demo - no actual download will occur)');
    }
  };

  const viewFullShop = () => {
    // Scroll to email signup or show coming soon message
    alert('Full shop coming soon! Sign up for our newsletter to be notified when it launches.');
    const emailSection = document.querySelector('#email-signup');
    if (emailSection) {
      emailSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section id="shop" className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="font-cinzel text-3xl md:text-4xl font-bold text-neutral-900 mb-4">
            Verified Picks
          </h2>
          <p className="font-lora text-lg text-neutral-600 max-w-2xl mx-auto">
            Carefully curated products and guides to enhance your travel and dining experiences.
          </p>
        </div>

        {/* 4 Products in a Row - Inline Layout */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {products.map((product, index) => (
            <div
              key={product.id}
              className="bg-white border border-neutral-200 rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300"
            >
              <div className="relative">
                <img
                  src={product.image}
                  alt={product.title}
                  className="w-full h-48 object-cover"
                />
                <div className="absolute top-3 right-3">
                  <span className="bg-white bg-opacity-95 px-2 py-1 rounded-full text-xs font-poppins font-semibold text-neutral-700">
                    {product.type}
                  </span>
                </div>
              </div>

              <div className="p-6">
                <h3 className="font-poppins text-lg font-semibold text-neutral-900 mb-2">
                  {product.title}
                </h3>

                <p className="font-lora text-neutral-600 text-sm mb-4 leading-relaxed">
                  {product.description}
                </p>

                <div className="flex items-center mb-4">
                  <div className="flex items-center">
                    <Star className="h-4 w-4 text-yellow-400 fill-current" />
                    <span className="ml-1 font-lora font-semibold text-neutral-700 text-sm">
                      {product.rating}
                    </span>
                  </div>
                  <span className="mx-2 text-neutral-300">•</span>
                  <span className="font-lora text-neutral-600 text-sm">
                    {product.reviews} reviews
                  </span>
                </div>

                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <span className="font-poppins text-xl font-bold text-neutral-900">
                      {product.price}
                    </span>
                    {product.originalPrice && (
                      <span className="ml-2 font-lora text-neutral-500 line-through text-sm">
                        {product.originalPrice}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button 
                    onClick={() => buyNow(product.id)}
                    className="flex-1 font-poppins bg-primary-500 text-white py-2 px-4 rounded-lg font-semibold hover:bg-primary-600 transition-colors duration-200 flex items-center justify-center text-sm"
                  >
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Buy Now
                  </button>
                  <button 
                    onClick={() => handleExternalLink(product)}
                    className="p-2 border border-neutral-200 rounded-lg hover:border-primary-500 hover:text-primary-500 transition-colors duration-200"
                    title={product.affiliateUrl ? "View on Amazon" : "Download"}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center">
          <button 
            onClick={viewFullShop}
            className="font-poppins bg-neutral-900 text-white px-8 py-3 rounded-lg font-semibold hover:bg-neutral-800 transition-colors duration-200"
          >
            View Full Shop
          </button>
        </div>
      </div>
    </section>
  );
};

export default VerifiedPicks;