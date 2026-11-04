// Daily unique visitor counter for the admin statistics (backend/visitors.js).
//
// Sends POST /api/visit once the visitor looks human, with the same heuristic as the
// Google Analytics loader in index.html: a real interaction, or a few seconds of
// visible page time. Automated browsers are skipped. The server deduplicates per day,
// so calling this again (e.g. after a login, to mark the visitor as logged in) is fine.

const VISIBLE_MS_THRESHOLD = 5000;
const HUMAN_EVENTS = ['pointerdown', 'keydown', 'scroll', 'touchstart', 'wheel'];

let looksHuman = false;
let waiters: (() => void)[] = [];
let listening = false;

function markHuman() {
  if (looksHuman) return;
  looksHuman = true;
  HUMAN_EVENTS.forEach(name => window.removeEventListener(name, markHuman, true));
  document.removeEventListener('visibilitychange', onVisibilityChange);
  clearTimeout(visibleTimer);
  const pending = waiters;
  waiters = [];
  pending.forEach(fn => fn());
}

let visibleTimer: ReturnType<typeof setTimeout> | undefined;
function onVisibilityChange() {
  clearTimeout(visibleTimer);
  if (document.visibilityState === 'visible') visibleTimer = setTimeout(markHuman, VISIBLE_MS_THRESHOLD);
}

function whenHuman(fn: () => void) {
  if (looksHuman) return fn();
  waiters.push(fn);
  if (listening) return;
  listening = true;
  HUMAN_EVENTS.forEach(name => window.addEventListener(name, markHuman, { capture: true, passive: true }));
  document.addEventListener('visibilitychange', onVisibilityChange);
  onVisibilityChange();
}

export function sendVisitBeacon(): void {
  if (navigator.webdriver) return; // Selenium/Puppeteer/Playwright
  whenHuman(() => {
    fetch('/api/visit', { method: 'POST', credentials: 'include', keepalive: true }).catch(() => {});
  });
}
