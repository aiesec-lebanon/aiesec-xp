"use client";

import { useActionState, useState } from "react";

import { sendPrivacyMessage } from "@/lib/privacy/contact-actions";
import {
  CONTACT_LIMITS,
  CONTACT_TOPICS,
  type ContactField,
  type ContactState,
} from "@/lib/privacy/contact";

const FIELD =
  "min-h-11 w-full rounded-xl border border-line bg-surface-raised px-3 py-2 text-base text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";
const LABEL = "mb-1.5 block text-sm font-semibold text-ink";
const FIELD_ERROR = "mt-1.5 text-sm text-break-ink";

type Values = Record<ContactField, string>;
const EMPTY: Values = { name: "", email: "", expaId: "", kind: "QUESTION", message: "" };

// Controlled fields: a form action resets uncontrolled ones, which would wipe
// a long message the moment one field needed fixing.
export function PrivacyContactForm() {
  const [state, formAction, pending] = useActionState<ContactState, FormData>(
    sendPrivacyMessage,
    { status: "idle" }
  );
  const [values, setValues] = useState<Values>(EMPTY);
  // Each send returns a new state object, so dismissing one never hides the next.
  const [dismissed, setDismissed] = useState<ContactState | null>(null);

  const fieldErrors = state.status === "error" ? (state.fieldErrors ?? {}) : {};

  function update(key: ContactField) {
    return (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setValues((current) => ({ ...current, [key]: event.target.value }));
  }

  function errorProps(key: ContactField) {
    return fieldErrors[key]
      ? { "aria-invalid": true as const, "aria-describedby": `contact-${key}-error` }
      : {};
  }

  function errorFor(key: ContactField) {
    return fieldErrors[key] ? (
      <div id={`contact-${key}-error`} className={FIELD_ERROR}>
        {fieldErrors[key]}
      </div>
    ) : null;
  }

  if (state.status === "sent" && state !== dismissed) {
    return (
      <div role="status" className="rounded-2xl bg-apd-wash p-6 text-ink">
        <div className="mb-2 font-semibold text-apd-ink">Message sent.</div>
        <div className="mb-4 text-sm">
          The privacy team will reply to {state.email} within one month. If you asked us to act on
          your data, we may first ask you to confirm it&apos;s you.
        </div>
        <button
          type="button"
          onClick={() => {
            setValues(EMPTY);
            setDismissed(state);
          }}
          className="min-h-10 rounded-full bg-surface-raised px-5 text-sm font-semibold shadow-e1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} aria-labelledby="contact" noValidate className="flex flex-col gap-5">
      <div aria-live="polite">
        {state.status === "error" && (
          <div role="alert" className="rounded-xl bg-break-wash px-4 py-3 text-sm text-break-ink">
            {state.error}
          </div>
        )}
      </div>

      <div>
        <label htmlFor="contact-name" className={LABEL}>
          Your name
        </label>
        <input
          id="contact-name"
          name="name"
          autoComplete="name"
          required
          maxLength={CONTACT_LIMITS.name}
          value={values.name}
          onChange={update("name")}
          className={FIELD}
          {...errorProps("name")}
        />
        {errorFor("name")}
      </div>

      <div>
        <label htmlFor="contact-email" className={LABEL}>
          Email for our reply
        </label>
        <input
          id="contact-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={CONTACT_LIMITS.email}
          value={values.email}
          onChange={update("email")}
          className={FIELD}
          {...errorProps("email")}
        />
        {errorFor("email")}
      </div>

      <div>
        <label htmlFor="contact-expaId" className={LABEL}>
          Your EXPA ID <span className="font-normal text-ink-muted">(optional, helps us find you)</span>
        </label>
        <input
          id="contact-expaId"
          name="expaId"
          inputMode="numeric"
          maxLength={CONTACT_LIMITS.expaId}
          value={values.expaId}
          onChange={update("expaId")}
          className={FIELD}
          {...errorProps("expaId")}
        />
        {errorFor("expaId")}
      </div>

      <div>
        <label htmlFor="contact-kind" className={LABEL}>
          What is it about?
        </label>
        <select
          id="contact-kind"
          name="kind"
          value={values.kind}
          onChange={update("kind")}
          className={FIELD}
          {...errorProps("kind")}
        >
          {CONTACT_TOPICS.map((topic) => (
            <option key={topic.kind} value={topic.kind}>
              {topic.label}
            </option>
          ))}
        </select>
        {errorFor("kind")}
      </div>

      <div>
        <label htmlFor="contact-message" className={LABEL}>
          Your message
        </label>
        <textarea
          id="contact-message"
          name="message"
          required
          rows={6}
          maxLength={CONTACT_LIMITS.message}
          value={values.message}
          onChange={update("message")}
          className={`${FIELD} resize-y`}
          {...errorProps("message")}
        />
        {errorFor("message")}
      </div>

      {/* Bots fill every field; people never reach this one. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="contact-website">Website</label>
        <input id="contact-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <div>
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded-full bg-ink px-6 text-sm font-semibold text-wall focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50"
        >
          {pending ? "Sending…" : "Send to the privacy team"}
        </button>
      </div>
    </form>
  );
}
