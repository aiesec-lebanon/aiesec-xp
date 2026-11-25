// The cookie and storage list behind the banner and the privacy notice. Names
// used in code elsewhere are listed here too; change both together.
export const COOKIE_POLICY_VERSION = "2026-11-25";
export const CONSENT_COOKIE = "ail_cookie_consent";
export const CONSENT_MAX_AGE_SECONDS = 182 * 24 * 60 * 60;

export const COOKIES = [
  {
    name: "__Host-xp_session",
    purpose: "Keeps you signed in",
    lifetime: "12 hours, or until you sign out (signing out ends it on every device)",
  },
  {
    name: "xp_oauth_state, xp_oauth_return_to",
    purpose: "Protect the AIESEC sign-in and return you to your page",
    lifetime: "10 minutes",
  },
  { name: "xp_reduce_motion", purpose: "Remembers your reduced-motion choice", lifetime: "1 year" },
  { name: CONSENT_COOKIE, purpose: "Remembers your cookie choice", lifetime: "6 months" },
] as const;

export const BROWSER_STORAGE = [
  {
    name: "xp:greeted:dashboard, xp:points:dashboard (session storage)",
    purpose: "Avoid repeating the greeting and the points animation",
    lifetime: "Until the tab is closed",
  },
] as const;
