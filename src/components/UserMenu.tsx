import React, { useState } from 'react';
import { User, Settings, LogOut, ChevronDown, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { User as UserType } from '../types/user';

interface UserMenuProps {
  user: UserType;
  onLogout: () => void;
}

const UserMenu: React.FC<UserMenuProps> = ({ user, onLogout }) => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    if (confirm('Are you sure you want to sign out?')) {
      onLogout();
      setIsOpen(false);
    }
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 text-white hover:text-primary-300 transition-colors duration-200"
      >
        <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center">
          <span className="font-poppins text-sm font-bold">
            {user.name?.charAt(0).toUpperCase() || 'U'}
          </span>
        </div>
        <div className="hidden md:block text-left">
          <div className="font-poppins text-sm font-semibold">{user.name}</div>
          {user.credits !== undefined && (
            <div className="font-lora text-xs opacity-75 flex items-center">
              <Zap className="h-3 w-3 mr-1" />
              {user.role === 'administrator' || user.credits >= 999999 ? '∞' : user.credits} credits
            </div>
          )}
        </div>
        <ChevronDown className="h-4 w-4" />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown Menu */}
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-neutral-200 z-20">
            <div className="py-2">
              <div className="px-4 py-2 border-b border-neutral-100">
                <div className="font-poppins text-sm font-semibold text-neutral-900">
                  {user.name}
                </div>
                <div className="font-lora text-xs text-neutral-600">
                  {user.email}
                </div>
              </div>
              
              <button
                onClick={() => handleNavigation('/dashboard')}
                className="w-full text-left px-4 py-2 font-lora text-sm text-neutral-700 hover:bg-neutral-50 flex items-center"
              >
                <User className="h-4 w-4 mr-2" />
                Dashboard
              </button>
              
              <button
                onClick={() => handleNavigation('/account')}
                className="w-full text-left px-4 py-2 font-lora text-sm text-neutral-700 hover:bg-neutral-50 flex items-center"
              >
                <Settings className="h-4 w-4 mr-2" />
                Account Settings
              </button>
              
              {user.role === 'administrator' && (
                <button
                  onClick={() => handleNavigation('/admin')}
                  className="w-full text-left px-4 py-2 font-lora text-sm text-neutral-700 hover:bg-neutral-50 flex items-center"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Admin Dashboard
                </button>
              )}
              
              <div className="border-t border-neutral-100 mt-2 pt-2">
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 font-lora text-sm text-red-600 hover:bg-red-50 flex items-center"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default UserMenu;