import React, { useState, useRef, useEffect } from 'react';
import * as Icons from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { User } from '../types/user';
import { UserService } from '../services/userService';
import { useAnalytics } from '../hooks/useAnalytics';

interface UserMenuProps {
  user: User;
  onLogout: () => void;
}

const UserMenu: React.FC<UserMenuProps> = ({ user, onLogout }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { trackEvent } = useAnalytics();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    // Show confirmation before logout
    if (confirm('Are you sure you want to log out completely?')) {
    trackEvent('user_logout', { user_id: user.id });
    UserService.logout();
    onLogout();
    setIsOpen(false);
    }
  };

  const menuItems = [
    {
      icon: Icons.User,
      label: user.role === 'administrator' ? 'User Dashboard' : 'Dashboard',
      action: () => {
        navigate('/dashboard');
        setIsOpen(false);
      }
    },
    ...(user.role === 'administrator' ? [
      {
        icon: Icons.LayoutDashboard,
        label: 'Admin Dashboard',
        action: () => {
          navigate('/admin');
          setIsOpen(false);
        }
      }
    ] : []),
    {
      icon: Icons.Settings,
      label: 'Account',
      action: () => {
        navigate('/account');
        setIsOpen(false);
      }
    },
    {
      icon: Icons.LogOut,
      label: 'Sign Out',
      action: handleLogout,
      className: 'text-red-600 hover:text-red-700 hover:bg-red-50'
    }
  ];

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-3 p-2 rounded-lg hover:bg-white/10 transition-colors duration-200"
      >
        <img
          src={user.avatar || 'https://images.pexels.com/photos/1126993/pexels-photo-1126993.jpeg?auto=compress&cs=tinysrgb&w=100'}
          alt={user.name}
          className="w-8 h-8 rounded-full object-cover border-2 border-white shadow-sm"
        />
        <div className="hidden md:block text-left">
          <div className="font-poppins text-sm font-semibold text-neutral-900">
            {user.name}
          </div>
          <div className="font-lora text-xs text-neutral-600 flex items-center">
            <Icons.Award className="h-3 w-3 mr-1" />
            Level {user.level}
          </div>
        </div>
        <Icons.ChevronDown className={`h-4 w-4 text-white transition-transform duration-200 ${
          isOpen ? 'rotate-180' : ''
        }`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-neutral-200 py-2 z-50">
          {/* User Info Header */}
          <div className="px-4 py-3 border-b border-neutral-100">
            <div className="flex items-center space-x-3">
              <img
                src={user.avatar || 'https://images.pexels.com/photos/1126993/pexels-photo-1126993.jpeg?auto=compress&cs=tinysrgb&w=100'}
                alt={user.name}
                className="w-10 h-10 rounded-full object-cover"
              />
              <div>
                <div className="font-poppins font-semibold text-neutral-900">
                  {user.name}
                </div>
                <div className="font-lora text-sm text-neutral-600">
                  {user.email}
                </div>
                <div className="flex items-center mt-1">
                  <Icons.Award className="h-3 w-3 text-primary-500 mr-1" />
                  <span className="font-poppins text-xs font-semibold text-primary-600">
                    Level {user.level} • {user.reviewCount} reviews •
                    <Icons.Zap className="h-3 w-3 inline mx-1 text-yellow-500" /> 
                    {user.credits >= 999999 ? '∞' : user.credits || 0} credits
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Menu Items Section */}
          <div className="py-2">
            {menuItems.map((item, index) => {
              const IconComponent = item.icon;
              return (
                <button
                  key={index}
                  onClick={item.action}
                  className={`w-full flex items-center px-4 py-2 text-left font-lora text-sm transition-colors duration-200 ${
                    item.className || 'text-neutral-700 hover:text-neutral-900 hover:bg-neutral-50'
                  }`}
                >
                  <IconComponent className="h-4 w-4 mr-3" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default UserMenu;