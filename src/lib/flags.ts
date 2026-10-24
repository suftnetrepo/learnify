/**
 * Feature flags — read from environment variables.
 * All flags default to false if the env var is missing or not "true".
 * Server-side only — never import this in client components.
 */

export function isTutorManagerEnabled(): boolean {
  return process.env.ENABLE_TUTOR_MANAGER === "true";
}

/** AI Tutor Pass for free courses. Off by default; off = free courses behave exactly as before. */
export function isAiTutorPassEnabled(): boolean {
  return process.env.ENABLE_AI_TUTOR_PASS === "true";
}
