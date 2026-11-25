import { z } from "zod";

// The contact form at the end of the privacy notice. A message is stored as a
// PrivacyRequest and read by the MC admins in XP, so no address is published
// and nothing leaves XP. Shared by the form, the action and the admin queue.

export const CONTACT_LIMITS = { name: 100, email: 254, expaId: 12, message: 4000 } as const;

export const CONTACT_TOPICS = [
  { kind: "QUESTION", label: "A question or a complaint" },
  { kind: "OBJECTION", label: "Take me off the leaderboards" },
  { kind: "ACCESS", label: "Ask what AIESEC XP holds about me" },
  { kind: "EXPORT", label: "Send me a copy of my data" },
  { kind: "RECTIFICATION", label: "Correct something that's wrong" },
  { kind: "ERASURE", label: "Erase my data" },
  { kind: "RESTRICTION", label: "Pause the use of my data while something is checked" },
] as const;

export type ContactKind = (typeof CONTACT_TOPICS)[number]["kind"];
export type ContactField = "name" | "email" | "expaId" | "kind" | "message";
export type ContactInput = {
  name: string;
  email: string;
  expaId: string | null;
  kind: ContactKind;
  message: string;
};

export type ContactState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "error"; error: string; fieldErrors?: Partial<Record<ContactField, string>> };

/** A request is answered within one month (GDPR Art. 12(3)). */
export const RESPONSE_DAYS = 30;

const KINDS = CONTACT_TOPICS.map((topic) => topic.kind) as string[];

const shape = z.object({
  name: z.string().max(CONTACT_LIMITS.name),
  email: z.string().max(CONTACT_LIMITS.email),
  expaId: z.string().max(CONTACT_LIMITS.expaId),
  kind: z.string(),
  message: z.string().max(CONTACT_LIMITS.message),
});

const TOO_LONG: Record<ContactField, string> = {
  name: `Use ${CONTACT_LIMITS.name} characters or fewer.`,
  email: "Use a shorter email address.",
  expaId: "An EXPA ID is a number of up to 12 digits.",
  kind: "Choose what your message is about.",
  message: `Keep your message to ${CONTACT_LIMITS.message} characters.`,
};

export function validateContact(
  raw: unknown
):
  | { ok: true; data: ContactInput }
  | { ok: false; fieldErrors: Partial<Record<ContactField, string>> } {
  const parsed = shape.safeParse(raw ?? {});
  if (!parsed.success) {
    const fieldErrors: Partial<Record<ContactField, string>> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as ContactField;
      if (key in TOO_LONG) fieldErrors[key] ??= TOO_LONG[key];
    }
    return {
      ok: false,
      fieldErrors: Object.keys(fieldErrors).length
        ? fieldErrors
        : { message: "Something was wrong with that message. Try again." },
    };
  }

  // One line, so the sender's name can't pass for part of the message.
  const name = parsed.data.name.replace(/\s+/g, " ").trim();
  const email = parsed.data.email.trim();
  const expaId = parsed.data.expaId.trim();
  const message = parsed.data.message.trim();

  const fieldErrors: Partial<Record<ContactField, string>> = {};
  if (!name) fieldErrors.name = "Enter your name.";
  if (!email) fieldErrors.email = "Enter the email we should reply to.";
  else if (!z.email().safeParse(email).success) {
    fieldErrors.email = "Enter an email like name@example.com.";
  }
  if (expaId && !/^\d{1,12}$/.test(expaId)) fieldErrors.expaId = TOO_LONG.expaId;
  if (!KINDS.includes(parsed.data.kind)) fieldErrors.kind = TOO_LONG.kind;
  if (!message) fieldErrors.message = "Write your message.";

  return Object.keys(fieldErrors).length
    ? { ok: false, fieldErrors }
    : {
        ok: true,
        data: { name, email, expaId: expaId || null, kind: parsed.data.kind as ContactKind, message },
      };
}

export function contactTopicLabel(kind: string): string {
  return CONTACT_TOPICS.find((topic) => topic.kind === kind)?.label ?? kind.toLowerCase();
}

/** A reply from the admin's own mail app, with the message quoted. No mail service. */
export function replyMailto(email: string, message: string): string {
  const quoted = message
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n")
    .slice(0, 1500);
  const subject = "Your message to the AIESEC XP privacy team";
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`\n\n${quoted}`)}`;
}
