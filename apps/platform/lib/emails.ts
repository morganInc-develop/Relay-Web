import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM_EMAIL = "RelayWeb <hello@morgandev.studio>"

interface SendEmailResult {
  success: boolean
  error?: string
}

// Email 0 — Welcome (new user signup)
export async function sendWelcomeEmail(
  to: string,
  name: string
): Promise<SendEmailResult> {
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: "Welcome to RelayWeb",
      html: `
        <h2>Welcome to RelayWeb 👋</h2>
        <p>Hi ${name ?? "there"},</p>
        <p>Your account is ready. The first step is to verify your domain so we can connect your site to your dashboard.</p>
        <p><a href="https://relay-web-beige.vercel.app/dashboard/site">Get started →</a></p>
        <p>If you have any questions, reply to this email — we're happy to help.</p>
        <p>— The RelayWeb Team</p>
      `,
    })
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error(`[Resend] Failed to send welcome email: ${message}`)
    return { success: false, error: message }
  }
}

// Email 1 — Domain verified confirmation
export async function sendDomainVerifiedEmail(
  to: string,
  name: string,
  domain: string
): Promise<SendEmailResult> {
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `Your domain ${domain} is verified — RelayWeb`,
      html: `
        <h2>Domain verified</h2>
        <p>Hi ${name ?? "there"},</p>
        <p>Your domain <strong>${domain}</strong> has been successfully verified and connected to your RelayWeb dashboard.</p>
        <p>You can now link your GitHub repo and Payload CMS instance to start editing your site content.</p>
        <p><a href="https://relay-web-beige.vercel.app/dashboard/site">Complete your setup →</a></p>
        <p>— The RelayWeb Team</p>
      `,
    })
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error(`[Resend] Failed to send domain verified email: ${message}`)
    return { success: false, error: message }
  }
}

// Email 2 — Subscription activated
export async function sendSubscriptionActivatedEmail(
  to: string,
  name: string,
  tierName: string
): Promise<SendEmailResult> {
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `Welcome to RelayWeb ${tierName} — Your subscription is active`,
      html: `
        <h2>You're all set 🎉</h2>
        <p>Hi ${name ?? "there"},</p>
        <p>Your <strong>${tierName}</strong> subscription is now active. You have full access to your RelayWeb dashboard.</p>
        <p>Your next step is to verify your domain and connect your site.</p>
        <p><a href="https://relay-web-beige.vercel.app/dashboard/site">Connect your site →</a></p>
        <p>Questions? Reply to this email or reach us at hello@morgandev.studio</p>
        <p>— The RelayWeb Team</p>
      `,
    })
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error(`[Resend] Failed to send subscription activated email: ${message}`)
    return { success: false, error: message }
  }
}

// Email 3 — Payment failed
export async function sendPaymentFailedEmail(
  to: string,
  name: string
): Promise<SendEmailResult> {
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: "Action required — Payment failed for your RelayWeb subscription",
      html: `
        <h2>Payment failed</h2>
        <p>Hi ${name ?? "there"},</p>
        <p>We were unable to process your last payment for your RelayWeb subscription.</p>
        <p>Please update your payment method to keep access to your dashboard.</p>
        <p><a href="https://relay-web-beige.vercel.app/dashboard/settings/billing">Update payment method →</a></p>
        <p>If you need help contact us at hello@morgandev.studio</p>
        <p>— The RelayWeb Team</p>
      `,
    })
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error(`[Resend] Failed to send payment failed email: ${message}`)
    return { success: false, error: message }
  }
}

// Email 4 — Subscription cancelled
export async function sendSubscriptionCancelledEmail(
  to: string,
  name: string,
  periodEnd: Date
): Promise<SendEmailResult> {
  const endDate = periodEnd.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: "Your RelayWeb subscription has been cancelled",
      html: `
        <h2>Subscription cancelled</h2>
        <p>Hi ${name ?? "there"},</p>
        <p>Your RelayWeb subscription has been cancelled. You will retain access until <strong>${endDate}</strong>.</p>
        <p>Your site content and data will be retained for 90 days after your access ends.</p>
        <p>Want to come back? Reactivate anytime from your billing settings.</p>
        <p><a href="https://relay-web-beige.vercel.app/dashboard/settings/billing">Reactivate subscription →</a></p>
        <p>— The RelayWeb Team</p>
      `,
    })
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error(`[Resend] Failed to send cancellation email: ${message}`)
    return { success: false, error: message }
  }
}

// Email 5 — Subscription reactivated
export async function sendSubscriptionReactivatedEmail(
  to: string,
  name: string,
  tierName: string
): Promise<SendEmailResult> {
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: "Welcome back — Your RelayWeb subscription is active again",
      html: `
        <h2>Welcome back! 👋</h2>
        <p>Hi ${name ?? "there"},</p>
        <p>Your <strong>${tierName}</strong> subscription has been reactivated. Everything is exactly as you left it.</p>
        <p><a href="https://relay-web-beige.vercel.app/dashboard">Go to dashboard →</a></p>
        <p>— The RelayWeb Team</p>
      `,
    })
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error(`[Resend] Failed to send reactivation email: ${message}`)
    return { success: false, error: message }
  }
}
