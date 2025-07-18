// Simplified analytics hooks

export const useAnalytics = () => {
  const trackEvent = (eventName: string, parameters: Record<string, any> = {}) => {
    console.log(`[Analytics] Event: ${eventName}`, parameters);
    
    // If Google Analytics is available, use it
    if (typeof gtag !== 'undefined') {
      gtag('event', eventName, parameters);
    }
    
    // If you're using other analytics services, add them here
  };

  const trackPageView = (pagePath: string, pageTitle: string = document.title) => {
    console.log(`[Analytics] Page View: ${pagePath}`, { title: pageTitle || document.title });
    
    // If Google Analytics is available, use it
    if (typeof gtag !== 'undefined') {
      gtag('config', 'G-XXXXXXXXXX', {
        page_path: pagePath,
        page_title: pageTitle
      });
    }
    
    // If you're using other analytics services, add them here
  };

  const trackEmailSignup = (leadMagnet: string, email?: string) => {
    trackEvent('email_signup', {
      lead_magnet: leadMagnet,
      email: email
    });
  };

  const trackSocialShare = (platform: string, contentType: string, contentId?: string) => {
    trackEvent('social_share', {
      platform: platform,
      content_type: contentType,
      content_id: contentId
    });
  };

  const trackAffiliateClick = (platform: string, businessName: string) => {
    trackEvent('affiliate_click', {
      platform: platform,
      business_name: businessName,
      value: 1
    });
  };

  const trackReviewView = (reviewId: string, businessName: string, category: string) => {
    trackEvent('review_view', {
      review_id: reviewId,
      business_name: businessName,
      category: category
    });
  };

  return {
    trackEvent,
    trackPageView,
    trackEmailSignup,
    trackSocialShare,
    trackAffiliateClick,
    trackReviewView
  };
};