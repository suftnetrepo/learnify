import { NextRequest, NextResponse } from "next/server";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN ?? "";

// Extract Sentry host from DSN
function getSentryHost(dsn: string): string | null {
  try {
    const url = new URL(dsn);
    return url.host;
  } catch {
    return null;
  }
}

async function tunnel(req: NextRequest): Promise<NextResponse> {
  if (!SENTRY_DSN) {
    return new NextResponse(null, { status: 200 });
  }

  const sentryHost = getSentryHost(SENTRY_DSN);
  if (!sentryHost) {
    return new NextResponse(null, { status: 400 });
  }

  try {
    const body = await req.text();
    const envelope = body.split("\n");
    const header   = JSON.parse(envelope[0] ?? "{}") as { dsn?: string };

    // Validate the DSN matches our configured one (prevent open proxy)
    if (header.dsn && getSentryHost(header.dsn) !== sentryHost) {
      return new NextResponse("Invalid DSN", { status: 400 });
    }

    const projectId = SENTRY_DSN.split("/").pop();
    const url = `https://${sentryHost}/api/${projectId}/envelope/`;

    const res = await fetch(url, {
      method:  "POST",
      headers: { "Content-Type": "application/x-sentry-envelope" },
      body,
    });

    return new NextResponse(await res.text(), { status: res.status });
  } catch (err) {
    console.error("Sentry tunnel error:", err);
    return new NextResponse(null, { status: 500 });
  }
}

export const GET  = tunnel;
export const POST = tunnel;
