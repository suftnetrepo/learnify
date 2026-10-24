/**
 * Test environment. DB-backed suites need TEST_DATABASE_URL pointing at a THROWAWAY Postgres with
 * the current schema (never a real database — every suite truncates the tables it touches).
 * Without it those suites are skipped.
 */
process.env.DATABASE_URL          = process.env.TEST_DATABASE_URL ?? "postgres://skip:skip@127.0.0.1:1/skip";
process.env.STRIPE_SECRET_KEY     = "sk_test_dummy_for_unit_tests";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_dummy_for_unit_tests";
process.env.STUDYMIND_API_KEY     = "sm_test_dummy";
process.env.STUDYMIND_API_URL     = "https://studymind.test";
process.env.NEXT_PUBLIC_APP_URL   = "https://learnify.test";
process.env.STRIPE_AI_PASS_PRICE_ID = "price_ai_pass_test";
process.env.CRON_SECRET           = "cron_test_secret";
delete process.env.ENABLE_AI_TUTOR_PASS;
delete process.env.ADMIN_EMAIL;
delete process.env.CAREERMIND_API_URL;

if (process.env.TEST_DATABASE_URL && !/127\.0\.0\.1|localhost/.test(process.env.TEST_DATABASE_URL)) {
  throw new Error("TEST_DATABASE_URL must point at a local throwaway database");
}
