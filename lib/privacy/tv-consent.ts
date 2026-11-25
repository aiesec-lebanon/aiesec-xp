// The wording a member agrees to before their name appears on the public /tv
// board. Bump the version whenever the text changes, so a recorded consent
// still says which wording it answered.
export const TV_CONSENT_VERSION = "2026-11-25";

export const TV_PLACEHOLDER_NAME = "AIESEC member";

export const TV_CONSENT_TEXT = {
  title: "Show your name on the office screen?",
  body: [
    "The office board shows the top 10 members and the latest results on screens in AIESEC offices. Anyone who opens the board can see it, without signing in.",
    `If you agree, your name appears there with your character and points. If you don't, you appear as "${TV_PLACEHOLDER_NAME}" instead.`,
    "Your points, your rewards and your place on the leaderboards inside AIESEC XP don't change either way. You can change your answer any time in your profile.",
  ],
} as const;
