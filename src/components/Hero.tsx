import React from 'react';
import { CheckCircle, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Hero = () => {
  const navigate = useNavigate();

  const scrollToSection = (sectionId: string) => {
    const element = document.querySelector(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section id="home" className="relative bg-neutral-50 py-16 lg:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div>
            <h1 className="font-cinzel text-4xl md:text-5xl lg:text-6xl font-bold text-neutral-900 leading-tight mb-6">
              ALL EXPERIENCES
            </h1>
            <h1 className="font-cinzel text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6">
              <span className="text-primary-500">VERIFIED</span> &
            </h1>
            <h1 className="font-cinzel text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6">
              <span className="text-primary-500">REVIEWED</span>
            </h1>
            
            <p className="font-poppins text-xl text-neutral-600 mb-8">
              So You Know If It's Worth the Trip.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <button 
                onClick={() => scrollToSection('#reviews')}
                className="font-poppins bg-primary-500 text-white px-8 py-3 rounded-lg font-semibold hover:bg-primary-600 transition-colors duration-200"
              >
                Explore Reviews
              </button>
            </div>

            {/* Trust Indicators */}
            <div className="flex flex-wrap items-center gap-6 text-neutral-600">
              <div className="flex items-center">
                <CheckCircle className="h-4 w-4 text-primary-500 mr-2" />
                <span className="font-lora text-sm font-medium">3.4M+ Views</span>
              </div>
              <div className="flex items-center">
                <CheckCircle className="h-4 w-4 text-primary-500 mr-2" />
                <span className="font-lora text-sm font-medium">Verified Reviews</span>
              </div>
              <div className="flex items-center">
                <CheckCircle className="h-4 w-4 text-primary-500 mr-2" />
                <span className="font-lora text-sm font-medium">Trusted by Thousands</span>
              </div>
            </div>
          </div>

          {/* Right Content - Review Card */}
          <div className="flex justify-center">
            <div className="bg-white rounded-2xl p-8 shadow-lg border border-neutral-200 max-w-md w-full">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-primary-500 mr-2" />
                  <span className="font-poppins text-sm font-semibold text-neutral-700">Every Review Verified</span>
                </div>
              </div>
              
              <p className="font-lora text-neutral-700 mb-6 leading-relaxed">
                Real experiences from real visits, ensuring you get honest insights for your next adventure.
              </p>
              
              <div className="flex items-center mb-4">
               <div className="flex items-center mr-3">
                 <img
                   src="https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=100"
                   alt="Reviewer profile"
                   className="w-8 h-8 rounded-full object-cover mr-2"
                 />
                 <div className="flex text-yellow-400">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-current" />
                  ))}
                 </div>
                </div>
               <span className="font-lora text-sm text-neutral-600">Sarah M. • Google Verified</span>
              </div>
              
              <p className="font-lora text-sm text-neutral-500">
                Join our community of reviewers and help others discover amazing experiences.
              </p>
              
              <div className="mt-4 pt-4 border-t border-neutral-100">
                <div className="font-lora text-xs text-neutral-400">Join 3,200+ reviewers</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;