import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance monitoring — capture 10% of transactions in production
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Only enable in production and staging
  enabled: process.env.NODE_ENV === "production",

  // Do not send errors from localhost
  beforeSend(event) {
    if (event.request?.url?.includes("localhost")) {
      return null
    }
    return event
  },
})
