import React from 'react';
import { CheckCircle, Star, Users, Award, Shield, Heart } from 'lucide-react';

const AboutPage = () => {
  const stats = [
    { icon: Star, value: '847+', label: 'Places Reviewed' },
    { icon: Users, value: '3.4M+', label: 'Google Views' },
    { icon: CheckCircle, value: '623', label: 'Clean Bathrooms Verified' },
    { icon: Award, value: '4.8', label: 'Average Rating' }
  ];

  const values = [
    {
      icon: Shield,
      title: 'Verified Experiences',
      description: 'Every review comes from an actual visit. We never review places we haven\'t personally experienced.'
    },
    {
      icon: Heart,
      title: 'Health & Cleanliness Focus',
      description: 'We prioritize health scores and cleanliness standards because your safety matters most.'
    },
    {
      icon: CheckCircle,
      title: 'Honest Reviews',
      description: 'We tell you the truth about our experiences - both the good and areas for improvement.'
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="py-20 bg-gradient-to-br from-primary-50 to-accent-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="font-cinzel text-4xl md:text-5xl font-bold text-neutral-900 mb-6">
            About Verified & Reviewed
          </h1>
          <p className="font-lora text-xl text-neutral-600 leading-relaxed">
            We're on a mission to help you discover amazing experiences while ensuring 
            every recommendation is verified, honest, and worth your time.
          </p>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => {
              const IconComponent = stat.icon;
              return (
                <div key={index} className="text-center">
                  <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <IconComponent className="h-8 w-8 text-primary-500" />
                  </div>
                  <div className="font-poppins text-3xl font-bold text-neutral-900 mb-2">
                    {stat.value}
                  </div>
                  <div className="font-lora text-neutral-600">
                    {stat.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Story Section */}
      <section className="py-16 bg-neutral-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-cinzel text-3xl font-bold text-neutral-900 mb-6">
              Our Story
            </h2>
          </div>
          
          <div className="prose prose-lg mx-auto">
            <div className="font-lora text-neutral-700 leading-relaxed space-y-6">
              <p>
                Verified & Reviewed started from a simple frustration: too many online reviews 
                felt fake, outdated, or unhelpful. We were tired of arriving at restaurants only 
                to find dirty bathrooms, poor service, or food that didn't match the glowing reviews.
              </p>
              
              <p>
                So we decided to do something about it. Every single review on our platform comes 
                from an actual visit. We don't accept paid reviews, we don't copy content from other 
                sites, and we never recommend places we haven't personally experienced.
              </p>
              
              <p>
                Our focus on health scores and cleanliness standards sets us apart. We believe that 
                great food and service mean nothing if basic hygiene standards aren't met. That's 
                why we developed our comprehensive health scoring system and always check (and report on) 
                bathroom cleanliness.
              </p>
              
              <p>
                Today, we've helped millions of people discover amazing experiences while avoiding 
                disappointing ones. Our community trusts us because we've earned that trust through 
                consistent, honest, and verified reviews.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-cinzel text-3xl font-bold text-neutral-900 mb-6">
              Our Values
            </h2>
            <p className="font-lora text-lg text-neutral-600 max-w-2xl mx-auto">
              These principles guide every review we write and every recommendation we make.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {values.map((value, index) => {
              const IconComponent = value.icon;
              return (
                <div key={index} className="text-center">
                  <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <IconComponent className="h-8 w-8 text-primary-500" />
                  </div>
                  <h3 className="font-poppins text-xl font-semibold text-neutral-900 mb-4">
                    {value.title}
                  </h3>
                  <p className="font-lora text-neutral-600 leading-relaxed">
                    {value.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Process Section */}
      <section className="py-16 bg-neutral-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-cinzel text-3xl font-bold text-neutral-900 mb-6">
              Our Review Process
            </h2>
            <p className="font-lora text-lg text-neutral-600">
              Here's exactly how we ensure every review is verified and valuable.
            </p>
          </div>
          
          <div className="space-y-8">
            <div className="flex items-start">
              <div className="flex-shrink-0 w-8 h-8 bg-primary-500 text-white rounded-full flex items-center justify-center font-poppins font-bold text-sm mr-4 mt-1">
                1
              </div>
              <div>
                <h3 className="font-poppins text-lg font-semibold text-neutral-900 mb-2">
                  We Visit In Person
                </h3>
                <p className="font-lora text-neutral-600">
                  Every review starts with an actual visit. We experience the service, food, 
                  and facilities just like any other customer.
                </p>
              </div>
            </div>
            
            <div className="flex items-start">
              <div className="flex-shrink-0 w-8 h-8 bg-primary-500 text-white rounded-full flex items-center justify-center font-poppins font-bold text-sm mr-4 mt-1">
                2
              </div>
              <div>
                <h3 className="font-poppins text-lg font-semibold text-neutral-900 mb-2">
                  We Document Everything
                </h3>
                <p className="font-lora text-neutral-600">
                  We take photos, notes, and carefully evaluate cleanliness, service, 
                  and overall experience using our standardized criteria.
                </p>
              </div>
            </div>
            
            <div className="flex items-start">
              <div className="flex-shrink-0 w-8 h-8 bg-primary-500 text-white rounded-full flex items-center justify-center font-poppins font-bold text-sm mr-4 mt-1">
                3
              </div>
              <div>
                <h3 className="font-poppins text-lg font-semibold text-neutral-900 mb-2">
                  We Score & Review
                </h3>
                <p className="font-lora text-neutral-600">
                  Each location receives a detailed health score (0-100) and overall rating 
                  based on our comprehensive evaluation system.
                </p>
              </div>
            </div>
            
            <div className="flex items-start">
              <div className="flex-shrink-0 w-8 h-8 bg-primary-500 text-white rounded-full flex items-center justify-center font-poppins font-bold text-sm mr-4 mt-1">
                4
              </div>
              <div>
                <h3 className="font-poppins text-lg font-semibold text-neutral-900 mb-2">
                  We Publish Honestly
                </h3>
                <p className="font-lora text-neutral-600">
                  Our reviews tell the complete truth - highlighting what's great and 
                  noting areas for improvement. No sugar-coating, no fake positivity.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-cinzel text-3xl font-bold text-neutral-900 mb-6">
            Get In Touch
          </h2>
          <p className="font-lora text-lg text-neutral-600 mb-8">
            Have a question, suggestion, or want to recommend a place for us to review?
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="font-poppins bg-primary-500 text-white px-8 py-3 rounded-lg font-semibold hover:bg-primary-600 transition-colors duration-200">
              Contact Us
            </button>
            <button className="font-poppins border-2 border-neutral-300 text-neutral-700 px-8 py-3 rounded-lg font-semibold hover:border-primary-500 hover:text-primary-500 transition-colors duration-200">
              Suggest a Place
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AboutPage;