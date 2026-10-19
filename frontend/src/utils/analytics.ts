// Thin wrapper around gtag for custom GA4 events.
//
// gtag() is defined in index.html before gtag.js is loaded (it is loaded lazily,
// once the visitor looks human), so calls made early are queued in dataLayer and
// sent once the library arrives - or never, for bot-like visits.

export type AnalyticsEvent =
  | 'build_created'
  | 'build_updated'
  | 'build_exported'
  | 'rating_submitted'
  | 'filter_used'
  | 'search'
  | 'login'
  | 'sign_up'
  | 'feedback_opened'
  | 'feedback_submitted'
  | 'chat_message_sent'
  | 'resource_clicked'
  | 'build_submitted_guest'
  | 'build_claimed'
  | 'build_form_started'
  | 'build_form_invalid'
  | 'build_form_warning'
  | 'build_auth_prompt'
  | 'build_guest_started'
  | 'build_submit_error';

type EventParams = Record<string, string | number | boolean | undefined>;

export function trackEvent(name: AnalyticsEvent, params: EventParams = {}): void {
  window.gtag?.('event', name, params);
}

// For events fired right before a full page load (login redirects, OAuth links):
// a plain trackEvent would be lost when the page unloads. Waits for GA to confirm
// the hit, but never longer than maxWaitMs - gtag.js may not be loaded at all.
export function trackEventThenNavigate(
  name: AnalyticsEvent,
  params: EventParams,
  url: string,
  maxWaitMs = 500
): void {
  let done = false;
  const go = () => {
    if (done) return;
    done = true;
    window.location.href = url;
  };
  window.gtag?.('event', name, { ...params, transport_type: 'beacon', event_callback: go });
  setTimeout(go, maxWaitMs);
}
