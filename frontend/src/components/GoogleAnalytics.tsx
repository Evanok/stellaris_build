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

// How long to wait for the new page to set its <title> before sending the page view
// anyway (pages keeping the same title as the previous one, or slow data fetches).
const TITLE_WAIT_MS = 1500;

export function GoogleAnalytics() {
  const location = useLocation();

  useEffect(() => {
    // Track page view on route change. Page titles are set by react-helmet-async
    // after lazy chunks and data fetches (e.g. the build name on /build/:id), so
    // reading document.title right away reports the previous page's title.
    // Wait until the title changes, or TITLE_WAIT_MS at most.
    const previousTitle = document.title;
    const pageLocation = window.location.href;
    const startedAt = Date.now();
    let sent = false;

    const sendPageView = () => {
      if (sent) return;
      sent = true;
      observer.disconnect();
      clearTimeout(timer);
      window.gtag?.('event', 'page_view', {
        page_path: location.pathname + location.search,
        page_location: pageLocation,
        page_title: document.title,
      });
    };

    const observer = new MutationObserver(() => {
      if (document.title !== previousTitle) sendPageView();
    });
    observer.observe(document.head, { subtree: true, childList: true, characterData: true });
    const timer = setTimeout(sendPageView, TITLE_WAIT_MS);

    // Navigating away before the title settled: still count the page we were on.
    // An immediate cleanup is StrictMode's dev-only mount/unmount/mount, not a
    // real visit - skip it, or every dev page load would be counted twice.
    return () => {
      if (Date.now() - startedAt > 300) sendPageView();
      else { sent = true; observer.disconnect(); clearTimeout(timer); }
    };
  }, [location]);

  return null; // This component doesn't render anything
}
