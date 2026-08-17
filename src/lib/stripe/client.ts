import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY environment variable is not set");
}

// Singleton — reused across serverless invocations
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-07-29.dahlia",
  typescript: true,
  appInfo: {
    name:    "Learnify",
    version: "1.0.0",
    url:     process.env.NEXT_PUBLIC_APP_URL,
  },
});
