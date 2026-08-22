/**
 * Feature flags — read from environment variables.
 * All flags default to false if the env var is missing or not "true".
 * Server-side only — never import this in client components.
 */

export function isTutorManagerEnabled(): boolean {
  return process.env.ENABLE_TUTOR_MANAGER === "true";
}
