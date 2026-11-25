"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import {
  CONSENT_COOKIE,
  CONSENT_MAX_AGE_SECONDS,
  COOKIE_POLICY_VERSION,
} from "@/lib/privacy/cookie-policy";

export const OPEN_COOKIE_PANEL_EVENT = "xp:open-cookie-panel";
const CHANGE_EVENT = "xp:cookie-consent-change";

// Cookies can be blocked; without this the banner would never go away.
let decidedInMemory = false;

function hasDecided(): boolean {
  if (decidedInMemory) return true;
  const raw = document.cookie
    .split("; ")
    .find((part) => part.startsWith(`${CONSENT_COOKIE}=`))
    ?.slice(CONSENT_COOKIE.length + 1);
  if (!raw) return false;
  try {
    return (JSON.parse(decodeURIComponent(raw)) as { v?: string }).v === COOKIE_POLICY_VERSION;
  } catch {
    return false;
  }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => window.removeEventListener(CHANGE_EVENT, onChange);
}

function saveConsent(allow: boolean) {
  const value = {
    v: COOKIE_POLICY_VERSION,
    necessary: true,
    performance: allow,
    marketing: allow,
    ts: new Date().toISOString(),
  };
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(value))}; Max-Age=${CONSENT_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
  decidedInMemory = true;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

const BUTTON =
  "min-h-10 rounded-full bg-surface px-5 text-sm font-semibold text-ink shadow-e1 transition-colors hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

const CATEGORIES = [
  ["Strictly necessary", "Sign-in, security and your settings (motion, this choice).", "Always on"],
  ["Performance", "Tell us how visitors use a platform.", "Not used on AIESEC XP"],
  ["Marketing", "Tailor offers and ads.", "Not used on AIESEC XP"],
] as const;

/**
 * The AIESEC in Lebanon cookie banner. AIESEC XP sets only strictly necessary
 * storage, so no answer turns anything on or off, and the banner says so;
 * Allow, Reject and Preferences still carry equal weight.
 */
export function CookieConsent() {
  // The server snapshot is "decided", so a returning visitor never sees a flash.
  const decided = useSyncExternalStore(subscribe, hasDecided, () => true);
  const [panelOpen, setPanelOpen] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const open = () => setPanelOpen(true);
    window.addEventListener(OPEN_COOKIE_PANEL_EVENT, open);
    return () => window.removeEventListener(OPEN_COOKIE_PANEL_EVENT, open);
  }, []);

  useEffect(() => {
    if (panelOpen) heading.current?.focus();
  }, [panelOpen]);

  // The office screen sets no cookies and nobody is there to answer.
  if (pathname?.startsWith("/tv")) return null;
  if (decided && !panelOpen) return null;

  function choose(allow: boolean) {
    saveConsent(allow);
    setPanelOpen(false);
  }

  return (
    <section
      aria-label={panelOpen ? "Cookie preferences" : "Cookie consent"}
      className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto bg-surface-raised shadow-e3"
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-6 py-4 text-sm text-ink">
        {panelOpen ? (
          <>
            <h2
              ref={heading}
              tabIndex={-1}
              className="font-display text-base font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              Cookie preferences
            </h2>
            <p className="text-ink-secondary">
              Some cookies are needed for AIESEC XP to work and can&apos;t be turned off. Anything
              else would need your consent. You can change your choice any time with the{" "}
              <strong>Cookies</strong> button at the bottom of every page.
            </p>
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">Cookie categories on AIESEC XP</caption>
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="py-2 pr-4">Category</th>
                  <th scope="col" className="py-2 pr-4">What it does</th>
                  <th scope="col" className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {CATEGORIES.map(([name, description, status]) => (
                  <tr key={name} className="border-b border-line">
                    <th scope="row" className="py-2 pr-4 font-medium">{name}</th>
                    <td className="py-2 pr-4 text-ink-secondary">{description}</td>
                    <td className="py-2">{status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <p className="text-ink-secondary">
            AIESEC XP uses only the cookies it needs to sign you in, keep it secure and remember your
            settings. It uses no analytics or advertising cookies.{" "}
            <Link href="/privacy#cookies" className="font-semibold text-ink underline">
              Cookie details
            </Link>
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => choose(true)} className={BUTTON}>
            Allow all
          </button>
          <button type="button" onClick={() => choose(false)} className={BUTTON}>
            Reject all
          </button>
          {!panelOpen && (
            <button type="button" onClick={() => setPanelOpen(true)} className={BUTTON}>
              Learn more / choose preferences
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

export function CookieSettingsButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_COOKIE_PANEL_EVENT))}
      className="underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      Cookies
    </button>
  );
}
