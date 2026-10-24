import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { deliverEmail, PermanentEmailError } from "@/lib/email";

// deliverEmail against a stubbed Brevo API (no network)
describe("deliverEmail (Brevo transport for the pass confirmation)", () => {
  let calls: { body: Record<string, unknown>; signal: boolean }[] = [];
  const respond = (status: number, body: unknown) => {
    calls = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      calls.push({ body: JSON.parse(String(init.body)), signal: !!init.signal });
      return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
    }));
  };
  beforeEach(() => {
    vi.stubEnv("BREVO_API_KEY", "xkeysib-test");
    vi.stubEnv("BREVO_FROM_EMAIL", "noreply@edquis.com");
    vi.stubEnv("EMAIL_SINK_DIR", "");
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it("sends the idempotency key in Brevo's headers object, with a request timeout", async () => {
    respond(201, { messageId: "<abc@smtp-relay.mailin.fr>" });
    const key = "6f2b7a3e-1c2d-4e5f-9a8b-7c6d5e4f3a2b";
    expect(await deliverEmail("student@gmail.com", "Subject", "<p>Hi</p>", { idempotencyKey: key }))
      .toEqual({ status: "sent", messageId: "<abc@smtp-relay.mailin.fr>" });
    expect(calls[0].body.headers).toEqual({ idempotencyKey: key });
    expect(calls[0].signal).toBe(true);
  });

  it("a repeated key (duplicate_parameter) means the provider already accepted it", async () => {
    respond(400, { code: "duplicate_parameter", message: "Duplicate idempotency key" });
    expect(await deliverEmail("student@gmail.com", "S", "<p>x</p>", { idempotencyKey: "k" })).toEqual({ status: "duplicate" });
  });

  it("a rejected recipient is permanent (not retried)", async () => {
    respond(400, { code: "invalid_parameter", message: "email is not valid" });
    await expect(deliverEmail("student@gmail.com", "S", "<p>x</p>")).rejects.toBeInstanceOf(PermanentEmailError);
  });

  it("rate limiting (429) is transient — the caller retries later", async () => {
    respond(429, { code: "too_many_requests", message: "slow down" });
    const err = await deliverEmail("student@gmail.com", "S", "<p>x</p>").catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(PermanentEmailError);
  });

  it("reserved test addresses are never sent", async () => {
    respond(201, {});
    expect(await deliverEmail("uat-student@learnify.local", "S", "<p>x</p>")).toEqual({ status: "skipped", reason: "reserved test address" });
    expect(calls).toHaveLength(0);
  });

  it("development sink writes the email to a file instead of sending (ignored in production)", async () => {
    respond(201, {});
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sink-"));
    vi.stubEnv("EMAIL_SINK_DIR", dir);
    const r = await deliverEmail("uat-student@learnify.local", "Your AI Tutor Pass is confirmed", "<p>x</p>");
    expect(r.status).toBe("sent");
    expect(fs.readdirSync(dir)).toHaveLength(1);
    expect(calls).toHaveLength(0);
    vi.stubEnv("NODE_ENV", "production");
    respond(201, { messageId: "m" });
    await deliverEmail("student@gmail.com", "S", "<p>x</p>");
    expect(calls).toHaveLength(1);          // sink ignored in production
    expect(fs.readdirSync(dir)).toHaveLength(1);
  });
});
