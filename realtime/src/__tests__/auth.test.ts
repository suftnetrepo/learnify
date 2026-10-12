import { describe, it, expect, beforeEach } from "vitest";
import jwt from "jsonwebtoken";
import { verifyToken } from "../auth";

const SECRET  = "test-secret";
const payload = {
  userId:    "11111111-1111-4111-8111-111111111111",
  sessionId: "22222222-2222-4222-8222-222222222222",
  role:      "viewer" as const,
  canEdit:   false,
};

describe("verifyToken", () => {
  beforeEach(() => { process.env.WHITEBOARD_JWT_SECRET = SECRET; });

  it("accepts a valid token", () => {
    const token = jwt.sign(payload, SECRET, { algorithm: "HS256", expiresIn: "4h" });
    expect(verifyToken(token)).toMatchObject(payload);
  });

  it("throws on an expired token", () => {
    const token = jwt.sign({ ...payload, exp: Math.floor(Date.now() / 1000) - 60 }, SECRET);
    expect(() => verifyToken(token)).toThrow(/expired/);
  });

  it("throws on a token signed with the wrong secret", () => {
    const token = jwt.sign(payload, "someone-else", { expiresIn: "4h" });
    expect(() => verifyToken(token)).toThrow(/signature/);
  });

  it("throws on a missing token", () => {
    expect(() => verifyToken(undefined)).toThrow(/Missing token/);
    expect(() => verifyToken("")).toThrow(/Missing token/);
  });

  it("throws when the payload has the wrong shape (no userId)", () => {
    const { userId: _omit, ...rest } = payload;
    void _omit;
    const token = jwt.sign(rest, SECRET, { expiresIn: "4h" });
    expect(() => verifyToken(token)).toThrow();
  });

  it("rejects tokens using a non-HS256 algorithm", () => {
    const token = jwt.sign(payload, SECRET, { algorithm: "HS512", expiresIn: "4h" });
    expect(() => verifyToken(token)).toThrow(/invalid algorithm/);
  });
});
