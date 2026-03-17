export function welcomeEmail(name: string): string {
  return `
    <h2>Welcome to RelayWeb, ${name}!</h2>
    <p>Your account is set up. Next step: verify your domain to connect your site to the dashboard.</p>
    <p>Log in any time at <a href="https://app.relayweb.com">app.relayweb.com</a>.</p>
    <p>— Damion, MorganDev Studio</p>
  `;
}

export function domainVerifiedEmail(domain: string): string {
  return `
    <h2>Domain verified — ${domain}</h2>
    <p>Your domain is connected. You can now link your site and start editing content from your dashboard.</p>
    <p>— Damion, MorganDev Studio</p>
  `;
}

export function subscriptionActivatedEmail(name: string, tier: string): string {
  return `
    <h2>You're all set, ${name}!</h2>
    <p>Your <strong>${tier}</strong> subscription is active. Head to your dashboard to get started.</p>
    <p>— Damion, MorganDev Studio</p>
  `;
}

export function scheduledPublishEmail(name: string, field: string, page: string): string {
  return `
    <h2>Your scheduled update is live, ${name}!</h2>
    <p>The change to <strong>${field}</strong> on <strong>${page}</strong> has been published to your site.</p>
    <p>— Damion, MorganDev Studio</p>
  `;
}
