import "server-only";
import { Resend } from "resend";

let resendClient: Resend | null = null;

export function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error("RESEND_API_KEY_MISSING");
  }

  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }

  return resendClient;
}

export function getEmailFromAddress() {
  const from = process.env.EMAIL_FROM || process.env.RESEND_FROM_EMAIL;

  if (!from) {
    throw new Error("EMAIL_FROM_MISSING");
  }

  return from;
}
