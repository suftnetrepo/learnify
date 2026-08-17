"use client";

import { GoogleReCaptchaProvider, useGoogleReCaptcha } from "react-google-recaptcha-v3";

const SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? "";

/** Wrap any page that contains a protected form */
export function RecaptchaProvider({ children }: { children: React.ReactNode }) {
  if (!SITE_KEY) return <>{children}</>;
  return (
    <GoogleReCaptchaProvider reCaptchaKey={SITE_KEY} scriptProps={{ async: true, defer: true }}>
      {children}
    </GoogleReCaptchaProvider>
  );
}

/** Returns a function that executes reCAPTCHA and returns the token */
export function useRecaptcha(action: string) {
  const { executeRecaptcha } = useGoogleReCaptcha();

  async function getToken(): Promise<string | null> {
    if (!SITE_KEY || !executeRecaptcha) return null;
    try {
      return await executeRecaptcha(action);
    } catch {
      return null;
    }
  }

  return getToken;
}
