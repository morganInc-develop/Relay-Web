export function welcomeEmail(name: string): string {
  return `
    <h2>Welcome to RelayWeb 👋</h2>
    <p>Hi ${name},</p>
    <p>Your account is ready. Start by verifying your domain.</p>
    <p><a href="https://relay-web-beige.vercel.app/dashboard/site">Get started →</a></p>
    <p>— The RelayWeb Team</p>
  `;
}

export function contentUpdatedEmail(name: string, field: string, page: string): string {
  return `
    <h2>Content updated</h2>
    <p>Hi ${name},</p>
    <p>Your client updated <strong>${field}</strong> on the <strong>${page}</strong> page.</p>
    <p><a href="https://relay-web-beige.vercel.app/dashboard/content">View changes →</a></p>
    <p>— The RelayWeb Team</p>
  `;
}

export function domainVerifiedEmail(domain: string): string {
  return `
    <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto;">
      <h2 style="color: #111;">Domain verified</h2>
      <p>Your domain <strong>${domain}</strong> is now connected.</p>
      <p style="color:#666;font-size:13px;">— The RelayWeb Team</p>
    </div>
  `;
}

export function subscriptionActivatedEmail(name: string, tier: string): string {
  return `
    <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto;">
      <h2 style="color: #111;">Subscription activated</h2>
      <p>Hi ${name},</p>
      <p>Your <strong>${tier}</strong> plan is active and ready to use.</p>
      <p style="color:#666;font-size:13px;">— The RelayWeb Team</p>
    </div>
  `;
}

export function scheduledPublishEmail(name: string, field: string, page: string): string {
  return `
    <h2>Scheduled update is live</h2>
    <p>Hi ${name},</p>
    <p>Your scheduled update to <strong>${field}</strong> on the
       <strong>${page}</strong> page is now live.</p>
    <p><a href="https://relay-web-beige.vercel.app/dashboard/content">View your site →</a></p>
    <p>— The RelayWeb Team</p>
  `;
}

export function aiChangeEmail(field: string, page: string, before: string, after: string): string {
  return `
    <h2>AI made a content change</h2>
    <p><strong>Page:</strong> ${page}</p>
    <p><strong>Field:</strong> ${field}</p>
    <p><strong>Before:</strong> ${before}</p>
    <p><strong>After:</strong> ${after}</p>
    <p>This change was confirmed by the client via the AI assistant.</p>
    <p>— RelayWeb</p>
  `;
}
