/**
 * Verifies a reCAPTCHA v3 token server-side.
 * Returns true if the token is valid and the score meets the threshold.
 *
 * Score guide (Google):
 *   1.0 = very likely human
 *   0.0 = very likely bot
 *   Default threshold of 0.5 is recommended for forms.
 *
 * Set RECAPTCHA_SECRET_KEY in your environment variables.
 * Get keys from: https://www.google.com/recaptcha/admin/create
 */
export async function verifyRecaptcha(
  token: string | null | undefined,
  threshold = 0.5
): Promise<{ success: boolean; score?: number; error?: string }> {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;

  // If not configured, pass through (dev / missing config)
  if (!secretKey || secretKey === "recaptcha_secret_placeholder") {
    return { success: true };
  }

  if (!token) {
    return { success: false, error: "No reCAPTCHA token provided" };
  }

  try {
    const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    new URLSearchParams({ secret: secretKey, response: token }),
    });

    const data = await res.json() as {
      success:      boolean;
      score:        number;
      action:       string;
      challenge_ts: string;
      hostname:     string;
      "error-codes"?: string[];
    };

    if (!data.success) {
      return { success: false, error: `reCAPTCHA failed: ${(data["error-codes"] ?? []).join(", ")}` };
    }

    if (data.score < threshold) {
      return { success: false, score: data.score, error: "reCAPTCHA score too low — possible bot" };
    }

    return { success: true, score: data.score };
  } catch (err) {
    // Never block a user because of a reCAPTCHA network error
    console.error("reCAPTCHA verification error:", err);
    return { success: true };
  }
}
