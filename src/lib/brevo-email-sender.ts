type Recipient = { email: string; name?: string };

export type SendParams = {
  to: Recipient[];
  sender: Recipient;
  subject: string;
  htmlContent?: string;
  textContent?: string;
};

export type SendResult =
  | { success: true; messageId?: string }
  | { success: false; error: string; status?: number; retryCount: number };

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

export class BrevoEmailSender {
  constructor(
    private readonly apiKey: string,
    private readonly maxRetries = 3,
    private readonly retryDelayMs = 1_000
  ) {
    if (!apiKey) throw new Error("Brevo API key is required");
  }

  private validate(params: SendParams): void {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!params.to.length) throw new Error("At least one email recipient is required");
    if (!emailPattern.test(params.sender.email)) throw new Error("Invalid sender email address");
    if (params.to.some(({ email }) => !emailPattern.test(email))) {
      throw new Error("Invalid recipient email address");
    }
    if (!params.subject.trim()) throw new Error("Email subject is required");
    if (!params.htmlContent && !params.textContent) throw new Error("Email content is required");
  }

  private async wait(attempt: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, this.retryDelayMs * attempt));
  }

  async sendEmail(params: SendParams, retryCount = 0): Promise<SendResult> {
    this.validate(params);

    try {
      const response = await fetch(BREVO_ENDPOINT, {
        method: "POST",
        headers: {
          accept: "application/json",
          "api-key": this.apiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify(params),
      });
      const body = (await response.json().catch(() => ({}))) as {
        messageId?: string;
        message?: string;
        code?: string;
      };

      if (response.ok) return { success: true, messageId: body.messageId };

      const error = [body.code, body.message].filter(Boolean).join(": ") || `HTTP ${response.status}`;
      if (response.status >= 500 && retryCount < this.maxRetries) {
        await this.wait(retryCount + 1);
        return this.sendEmail(params, retryCount + 1);
      }
      return { success: false, error, status: response.status, retryCount };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown network error";
      if (retryCount < this.maxRetries) {
        await this.wait(retryCount + 1);
        return this.sendEmail(params, retryCount + 1);
      }
      return { success: false, error: message, retryCount };
    }
  }
}
