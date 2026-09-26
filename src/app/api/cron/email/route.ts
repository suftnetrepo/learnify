import { NextRequest } from "next/server";
import { processEmailQueue } from "@/lib/email";
import { successResponse, unauthorized, serverError } from "@/lib/api-response";
import { log } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || authorization !== `Bearer ${secret}`) return unauthorized();

  try {
    return successResponse(await processEmailQueue());
  } catch (error) {
    log.error("Email queue processor failed", { error });
    return serverError("Email queue processor failed");
  }
}
