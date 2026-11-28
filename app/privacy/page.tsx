import Link from "next/link";

import { PrivacyContactForm } from "@/components/privacy/contact-form";
import { BROWSER_STORAGE, COOKIES } from "@/lib/privacy/cookie-policy";
import { TV_PLACEHOLDER_NAME } from "@/lib/privacy/tv-consent";

export const metadata = {
  title: "Privacy notice · AIESEC XP",
  description: "What AIESEC XP holds about you, why, for how long, and what you can do about it.",
};

// Derived from Annex E of the AIESEC in Lebanon Privacy and Cookie Policy;
// change both together.
const LAST_UPDATED = "25 November 2026";

const RETENTION: Array<[string, string]> = [
  ["Points, counts and EP events", "The current term and 12 months after it"],
  ["Your member record", "Deleted 12 months after your last AIESEC position ends"],
  ["Sign-in events", "90 days"],
  ["Refused sign-ins", "30 days, holding a keyed reference instead of your EXPA ID"],
  ["Admin change log", "24 months"],
  ["EP IDs that EXPA no longer returns", "Deleted at the next daily clean-up"],
  [
    "Messages to the privacy team",
    "3 years after they are closed; the email for our reply is removed on closure",
  ],
];

const H2 = "mt-10 font-display text-xl font-semibold text-ink scroll-mt-6";
const H3 = "mt-6 text-base font-semibold text-ink";
const P = "mt-3 text-[15px] leading-relaxed text-ink-secondary";
const LIST = "mt-3 list-disc space-y-2 pl-6 text-[15px] leading-relaxed text-ink-secondary";
const LINK = "font-semibold text-ink underline underline-offset-2";

function Table({ caption, rows }: { caption: string; rows: ReadonlyArray<readonly [string, string, string?]> }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <tbody>
          {rows.map(([first, second, third]) => (
            <tr key={first} className="border-b border-line align-top">
              <th scope="row" className="py-2.5 pr-4 font-semibold text-ink">
                {first}
              </th>
              <td className="py-2.5 pr-4 text-ink-secondary">{second}</td>
              {third !== undefined && <td className="py-2.5 text-ink-secondary">{third}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 pb-24 pt-12">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">AIESEC XP</p>
      <h1 className="mt-2 font-display text-3xl font-semibold text-ink">Privacy notice</h1>
      <p className={P}>
        What AIESEC XP holds about you, why, how long it is kept, and what you can ask us to do.
        Last updated {LAST_UPDATED}.
      </p>

      <h2 className={H2}>Who is responsible</h2>
      <p className={P}>
        <strong className="text-ink">AIESEC in Lebanon</strong> runs AIESEC XP and is the controller
        of the personal data in it. AIESEC International remains the controller of EXPA and GIS, from
        which XP reads. Questions go to our Data Protection Officer through the{" "}
        <a href="#contact" className={LINK}>
          contact form
        </a>{" "}
        at the end of this page.
      </p>

      <h2 className={H2}>What we hold</h2>
      <h3 className={H3}>About members</h3>
      <p className={P}>
        Your EXPA person ID, name, positions (role, office and dates) and whether you opted out of
        statistical use in EXPA, read from GIS when you sign in and once a week. In XP itself: the
        character you pick, your points and counts per period, the rewards you reach, your sign-in
        times, and your answer about the office screen.
      </p>
      <h3 className={H3}>About exchange participants (EPs)</h3>
      <p className={P}>
        Only the EXPA person ID and application ID, with the application&apos;s status, dates and
        programme, and which members are credited with it. We do not store EP names or contact
        details. Admins see an EP&apos;s name while assigning credit; it is read live from EXPA and
        not kept.
      </p>
      <h3 className={H3}>From the MC sign-up sheet</h3>
      <p className={P}>
        XP reads only four columns of the MC&apos;s sign-up sheet: the EP ID, the manager, the LC and
        the team. The sheet stays private and is read through a Google account that has view access
        only.
      </p>

      <h2 className={H2}>Why we use it</h2>
      <ul className={LIST}>
        <li>
          <strong className="text-ink">Recognising and motivating members</strong> through points,
          leaderboards and rewards: our legitimate interest (GDPR Art. 6(1)(f)).
        </li>
        <li>
          <strong className="text-ink">Your name on the office screen</strong>: your consent (Art.
          6(1)(a)), which you can withdraw at any time.
        </li>
        <li>
          <strong className="text-ink">Answering your privacy requests</strong>: a legal obligation
          (Art. 6(1)(c)).
        </li>
      </ul>

      <h2 className={H2}>Leaderboards and the office screen</h2>
      <p className={P}>
        The leaderboards inside XP are seen only by signed-in members of AIESEC in Lebanon. If you
        opted out of statistical use in EXPA, you are left off every leaderboard automatically. If
        you object to appearing on them, tell us with the contact form and an admin takes you off;
        you keep your points and rewards either way.
      </p>
      <p className={P}>
        The office screen shows the top 10 members and the latest results, and anyone who opens it
        can see it without signing in. Your name appears there only if you said yes when XP asked
        you; otherwise you are shown as &ldquo;{TV_PLACEHOLDER_NAME}&rdquo;. You can change your
        answer at any time in your{" "}
        <Link href="/me" className={LINK}>
          profile
        </Link>
        .
      </p>

      <h2 className={H2}>Rewards</h2>
      <p className={P}>
        Reaching a reward&apos;s threshold makes you eligible. The MC decides on and hands out each
        reward. XP makes no decision about you that has legal or similarly significant effects.
      </p>

      <h2 className={H2}>Who sees it</h2>
      <ul className={LIST}>
        <li>Signed-in members: the leaderboards and their own progress.</li>
        <li>Anyone at the office screen: the names of members who agreed, with points.</li>
        <li>MC admins: the assignment console and privacy requests.</li>
        <li>
          Our processors: Vercel (hosting), Supabase (database), GitHub (starts the scheduled
          updates) and Google (reading the sign-up sheet).
        </li>
      </ul>

      <h2 className={H2}>Where it is held</h2>
      <p className={P}>
        The database (Supabase) and the application (Vercel) run in{" "}
        <strong className="text-ink">Mumbai, India</strong>. India has no adequacy decision from the
        European Commission, so these transfers rely on the Standard Contractual Clauses in our
        providers&apos; data processing agreements.
        The scheduled updates are started from GitHub in the United States, which receives no
        personal data.
      </p>

      <h2 className={H2}>How long we keep it</h2>
      <Table caption="Retention periods, enforced by a daily clean-up" rows={RETENTION} />

      <h2 className={H2}>Your rights</h2>
      <p className={P}>
        You can ask for access to your data, a copy of it, correction, erasure, restriction, or
        object to its use, with the contact form below; it works even if you can no longer sign in.
        Signed-in members can download their data at any time from their{" "}
        <Link href="/me" className={LINK}>
          profile
        </Link>
        . We answer within one month and may first ask you to confirm who you are. You can also
        complain to a data protection supervisory authority, in particular where you live or work.
      </p>

      <h2 id="cookies" className={H2}>
        Cookies and browser storage
      </h2>
      <p className={P}>
        XP uses only what it needs to sign you in, keep it secure and remember your settings. It
        uses no analytics or advertising cookies. You can review your choice with the Cookies button
        at the bottom of every page.
      </p>
      <Table
        caption="Cookies and browser storage used by AIESEC XP"
        rows={[...COOKIES, ...BROWSER_STORAGE].map((item) => [item.name, item.purpose, item.lifetime])}
      />

      <h2 id="contact" className={H2}>
        Contact the privacy team
      </h2>
      <p className={`${P} mb-6`}>
        Your message goes to the AIESEC in Lebanon Data Protection Officer inside XP. It is not sent
        to any other service, and we answer from our own email to the address you give. If you are
        signed in, your message is linked to your account so we know it is you.
      </p>
      <PrivacyContactForm />
    </main>
  );
}
