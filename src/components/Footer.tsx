import React from 'react';
import { useNavigate } from 'react-router-dom';

const Footer: React.FC = () => {
  const navigate = useNavigate();
  
  const footerLinks = [
    { name: 'Blog', action: () => navigate('/blog') },
    { name: 'Privacy Policy', action: () => alert('Privacy Policy - Coming Soon') },
    { name: 'Terms of Service', action: () => alert('Terms of Service - Coming Soon') },
    { name: 'Contact Us', action: () => alert('Contact form coming soon!') }
  ];

  return (
    <footer className="bg-neutral-900 text-white py-4">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between">
          {/* Logo and Copyright */}
          <div className="flex items-center mb-4 md:mb-0">
            <img 
              src="/verified and reviewed logo-coral copy copy.png" 
              alt="Verified & Reviewed" 
              className="h-6 w-6 mr-2"
            />
            <span className="font-cinzel text-sm">
              Verified & Reviewed
            </span>
          </div>
          
          {/* Links */}
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mb-4 md:mb-0">
            {footerLinks.map((link) => (
              <button
                key={link.name}
                onClick={link.action}
                className="font-lora text-xs text-neutral-400 hover:text-primary-500 transition-colors duration-200"
              >
                {link.name}
              </button>
            ))}
          </div>
          
          {/* Admin Link and Copyright */}
          <div className="flex items-center">
            <span className="font-lora text-xs text-neutral-500 mr-4">
              © 2024
            </span>
            <a
              href="/admin"
              className="text-neutral-500 hover:text-primary-500 transition-colors duration-200 text-xs"
              title="Admin"
            >
              Admin
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;