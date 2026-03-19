import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = "RelayWeb <hello@morgandev.studio>";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(opts: SendEmailOptions): Promise<void> {
  try {
    await resend.emails.send({ from: FROM, ...opts });
  } catch (err) {
    console.error("[email] Failed to send:", err);
  }
}
