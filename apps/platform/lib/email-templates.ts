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

export function aiLimitReachedEmail(name: string): string {
  return `
    <h2>AI request limit reached</h2>
    <p>Hi ${name},</p>
    <p>You reached your current AI request limit for this period.</p>
    <p>Need more changes this month? Ask about a managed plan.</p>
    <p>Reply to this email or contact hello@morgandev.studio.</p>
    <p>— RelayWeb</p>
  `;
}

export function seoLowScoreEmail(page: string, score: number): string {
  return `
    <h2>SEO score is below target</h2>
    <p>Your latest SEO audit for <strong>${page}</strong> scored <strong>${score}</strong>/100.</p>
    <p>We recommend reaching out for hands-on optimization support.</p>
    <p>Contact hello@morgandev.studio for agency help.</p>
    <p>— RelayWeb</p>
  `;
}

export function teamInviteEmail(
  inviterName: string,
  siteName: string,
  inviteUrl: string
): string {
  return `
    <h2>You were invited to RelayWeb</h2>
    <p><strong>${inviterName}</strong> invited you to join <strong>${siteName}</strong>.</p>
    <p><a href="${inviteUrl}">Accept invite</a></p>
    <p>If the button does not work, copy this URL:</p>
    <p>${inviteUrl}</p>
    <p>— RelayWeb</p>
  `;
}

export function monthlyAiSiteReportEmail(params: {
  domain: string
  month: string
  contentChanges: number
  seoScans: number
  aiActions: number
  avgSeoScore: number | null
}): string {
  const scoreLine =
    params.avgSeoScore === null
      ? "No SEO audits were run this month."
      : `Average SEO score this month: <strong>${params.avgSeoScore}</strong>/100`

  return `
    <h2>Monthly AI site report</h2>
    <p><strong>Domain:</strong> ${params.domain}</p>
    <p><strong>Month:</strong> ${params.month}</p>
    <p><strong>AI actions applied:</strong> ${params.aiActions}</p>
    <p><strong>Content changes:</strong> ${params.contentChanges}</p>
    <p><strong>SEO scans:</strong> ${params.seoScans}</p>
    <p>${scoreLine}</p>
    <p>— RelayWeb</p>
  `;
}
