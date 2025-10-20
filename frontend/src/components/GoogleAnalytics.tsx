import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Declare gtag function for TypeScript
declare global {
  interface Window {
    gtag?: (
      command: 'config' | 'event' | 'js',
      targetId: string | Date,
      config?: Record<string, any>
    ) => void;
    dataLayer?: any[];
  }
}

export function GoogleAnalytics() {
  const location = useLocation();

  useEffect(() => {
    // Track page view on route change
    if (typeof window.gtag !== 'undefined') {
      window.gtag('event', 'page_view', {
        page_path: location.pathname + location.search,
        page_location: window.location.href,
        page_title: document.title,
      });
    }
  }, [location]);

  return null; // This component doesn't render anything
}
