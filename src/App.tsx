import React, { lazy, Suspense, useState, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Navigation from './components/Navigation';
import ScrollToTop from './components/ScrollToTop';
import Footer from './components/Footer';
import { useActivityTracking } from './hooks/useActivityTracking';

// Lazy load pages to reduce initial bundle size
const HomePage = lazy(() => import('./pages/HomePage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const BlogPage = lazy(() => import('./pages/BlogPage'));
const SinglePostPage = lazy(() => import('./pages/SinglePostPage'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AccountPage = lazy(() => import('./pages/AccountPage'));
const ReviewerDashboardPage = lazy(() => import('./pages/ReviewerDashboardPage'));
const AddBusinessPage = lazy(() => import('./pages/AddBusinessPage'));

function App() {
  const [isAppModeActive, setIsAppModeActive] = useState(false);
  const location = useLocation();
  
  // Enable automatic activity tracking
  useActivityTracking();
  
  // Auto-refresh when app is reopened (tab becomes visible again)
  useEffect(() => {
    const handleVisibilityChange = () => {
      // Only refresh if the document becomes visible (user returns to tab)
      if (document.visibilityState === 'visible') {
        // Check if the page has been hidden for more than 30 seconds
        const lastHiddenTime = sessionStorage.getItem('app-last-hidden');
        if (lastHiddenTime) {
          const timeDiff = Date.now() - parseInt(lastHiddenTime);
          // Refresh if hidden for more than 30 seconds (30000ms)
          if (timeDiff > 30000) {
            console.log('🔄 Auto-refreshing app after being hidden for', Math.round(timeDiff / 1000), 'seconds');
            window.location.reload();
            return;
          }
        }
      } else {
        // Document is hidden, record the time
        sessionStorage.setItem('app-last-hidden', Date.now().toString());
      }
    };

    // Listen for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Also listen for focus events as a backup
    const handleWindowFocus = () => {
      const lastHiddenTime = sessionStorage.getItem('app-last-hidden');
      if (lastHiddenTime) {
        const timeDiff = Date.now() - parseInt(lastHiddenTime);
        if (timeDiff > 30000) {
          console.log('🔄 Auto-refreshing app on window focus after', Math.round(timeDiff / 1000), 'seconds');
          window.location.reload();
        }
      }
    };
    
    window.addEventListener('focus', handleWindowFocus);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, []);
  
  // Apply no-scroll class to body when in app mode
  useEffect(() => {
    if (isAppModeActive) {
      document.body.classList.add('app-mode-active');
    } else {
      document.body.classList.remove('app-mode-active');
    }
    
    return () => {
      document.body.classList.remove('app-mode-active');
    };
  }, [isAppModeActive]);
  
  return (
    <div className="min-h-screen bg-neutral-50">
      <ScrollToTop />
      {!isAppModeActive && <Navigation isAppModeActive={isAppModeActive} />}
      
      <Suspense fallback={
        <div className="min-h-[30vh] flex items-center justify-center">
          <div className="animate-pulse text-center">
            <div className="h-8 w-32 bg-neutral-200 rounded mx-auto mb-4"></div>
            <div className="h-4 w-48 bg-neutral-200 rounded mx-auto"></div>
          </div>
        </div>
      }>
        <Routes>
          <Route path="/" element={<HomePage isAppModeActive={isAppModeActive} setIsAppModeActive={setIsAppModeActive} />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/blogs" element={<BlogPage />} />
          <Route path="/post/:slug" element={<SinglePostPage />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/dashboard" element={<ReviewerDashboardPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/add-business" element={<AddBusinessPage />} />
        </Routes>
      </Suspense>
      
      {!isAppModeActive && <Footer />}
    </div>
  );
}

export default App;