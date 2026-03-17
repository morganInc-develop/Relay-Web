import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { SubscriptionStatus, SubscriptionTier } from "@prisma/client";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { sendEmail } from "@/lib/email";
import { subscriptionActivatedEmail } from "@/lib/email-templates";
import { sendPaymentFailedEmail } from "@/lib/emails";
import { checkRateLimit, rateLimiters } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type StripeSubscriptionWithPeriods = Stripe.Subscription & {
  current_period_start?: number;
  current_period_end?: number;
};

type StripeInvoiceWithSubscription = Stripe.Invoice & {
  subscription?: string | null;
  period_start?: number;
  period_end?: number;
};

function normalizeSecret(value: string | undefined | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim() || null;
  }
  return trimmed;
}

function addSecret(set: Set<string>, rawValue: string | undefined | null) {
  const normalized = normalizeSecret(rawValue);
  if (normalized) set.add(normalized);
}

async function resolveWebhookSecrets(): Promise<string[]> {
  const secrets = new Set<string>();

  addSecret(secrets, process.env.STRIPE_WEBHOOK_SECRET);

  const commaSeparated = process.env.STRIPE_WEBHOOK_SECRETS;
  if (commaSeparated) {
    for (const part of commaSeparated.split(",")) {
      addSecret(secrets, part);
    }
  }

  try {
    const envFile = await readFile(join(process.cwd(), ".env.local"), "utf8");
    for (const line of envFile.split(/\r?\n/)) {
      if (line.startsWith("STRIPE_WEBHOOK_SECRET=")) {
        addSecret(secrets, line.split("=").slice(1).join("="));
      }
      if (line.startsWith("STRIPE_WEBHOOK_SECRETS=")) {
        for (const part of line.split("=").slice(1).join("=").split(",")) {
          addSecret(secrets, part);
        }
      }
    }
  } catch {
    // Ignore missing local env file.
  }

  return Array.from(secrets);
}

function toDateOrNull(unixSeconds: number | undefined): Date | null {
  if (typeof unixSeconds !== "number" || !Number.isFinite(unixSeconds)) {
    return null;
  }
  return new Date(unixSeconds * 1000);
}

function resolveSubscriptionPeriods(subscription: StripeSubscriptionWithPeriods): {
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
} {
  const firstItem = subscription.items.data[0] as
    | { current_period_start?: number; current_period_end?: number }
    | undefined;

  const startSeconds = subscription.current_period_start ?? firstItem?.current_period_start;
  const endSeconds = subscription.current_period_end ?? firstItem?.current_period_end;

  return {
    currentPeriodStart: toDateOrNull(startSeconds),
    currentPeriodEnd: toDateOrNull(endSeconds),
  };
}

function resolveInvoicePeriods(invoice: StripeInvoiceWithSubscription): {
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
} {
  const invoiceWithLines = invoice as StripeInvoiceWithSubscription & {
    lines?: {
      data?: Array<{
        period?: { start?: number; end?: number };
      }>;
    };
  };

  const firstLinePeriod = invoiceWithLines.lines?.data?.[0]?.period;
  const startSeconds = invoice.period_start ?? firstLinePeriod?.start;
  const endSeconds = invoice.period_end ?? firstLinePeriod?.end;

  return {
    currentPeriodStart: toDateOrNull(startSeconds),
    currentPeriodEnd: toDateOrNull(endSeconds),
  };
}

export async function POST(req: Request) {
  // Add at the top of the POST handler — get IP from request headers
  const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";
  const webhookRateLimit = await checkRateLimit(rateLimiters.stripeWebhook, ip);
  if (!webhookRateLimit.success) return webhookRateLimit.response!;

  const body = await req.text();
  const sig = (await headers()).get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  const webhookSecrets = await resolveWebhookSecrets();

  let event: Stripe.Event | null = null;
  for (const webhookSecret of webhookSecrets) {
    try {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
      break;
    } catch {
      // Try the next configured secret.
    }
  }

  if (!event) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const tier = session.metadata?.tier;
      const stripeSubscriptionId = session.subscription as string;
      const stripeCustomerId = session.customer as string;

      if (!userId || !tier || !stripeSubscriptionId) {
        return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
      }

      const stripeSubscription = (await stripe.subscriptions.retrieve(
        stripeSubscriptionId,
      )) as unknown as StripeSubscriptionWithPeriods;
      const { currentPeriodStart, currentPeriodEnd } =
        resolveSubscriptionPeriods(stripeSubscription);

      const tierMap: Record<string, SubscriptionTier> = {
        "1": SubscriptionTier.TIER1,
        "2": SubscriptionTier.TIER2,
        "3": SubscriptionTier.TIER3,
        TIER1: SubscriptionTier.TIER1,
        TIER2: SubscriptionTier.TIER2,
        TIER3: SubscriptionTier.TIER3,
      };
      const subscriptionTier = tierMap[tier];
      if (!subscriptionTier) {
        return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
      }

      await prisma.subscription.upsert({
        where: { userId },
        create: {
          userId,
          tier: subscriptionTier,
          status: SubscriptionStatus.ACTIVE,
          stripeCustomerId,
          stripeSubscriptionId,
          stripePriceId: stripeSubscription.items.data[0].price.id,
          currentPeriodStart,
          currentPeriodEnd,
          cancelAtPeriodEnd: false,
        },
        update: {
          tier: subscriptionTier,
          status: SubscriptionStatus.ACTIVE,
          stripeCustomerId,
          stripeSubscriptionId,
          stripePriceId: stripeSubscription.items.data[0].price.id,
          currentPeriodStart,
          currentPeriodEnd,
          cancelAtPeriodEnd: false,
        },
      });

      const site = await prisma.site.findFirst({ where: { ownerId: userId } });
      if (site) {
        await prisma.aIUsage.upsert({
          where: { siteId: site.id },
          create: { siteId: site.id, chatRequests: 0, seoAudits: 0 },
          update: {},
        });
      }
      break;
    }

    case "customer.subscription.created": {
      const subscription = event.data.object as StripeSubscriptionWithPeriods;
      const customer = subscription.customer;

      if (typeof customer !== "string") {
        break;
      }

      const { currentPeriodStart, currentPeriodEnd } =
        resolveSubscriptionPeriods(subscription);
      const stripePriceId = subscription.items.data[0]?.price.id ?? null;

      const priceToTier: Record<string, SubscriptionTier> = {
        [process.env.STRIPE_PRICE_STARTER ?? ""]: SubscriptionTier.TIER1,
        [process.env.STRIPE_PRICE_GROWTH ?? ""]: SubscriptionTier.TIER2,
        [process.env.STRIPE_PRICE_PRO ?? ""]: SubscriptionTier.TIER3,
      };
      const subscriptionTier = stripePriceId
        ? priceToTier[stripePriceId]
        : undefined;

      const updated = await prisma.subscription.updateMany({
        where: { stripeCustomerId: customer },
        data: {
          ...(subscriptionTier ? { tier: subscriptionTier } : {}),
          status: SubscriptionStatus.ACTIVE,
          stripeSubscriptionId: subscription.id,
          stripePriceId,
          currentPeriodStart,
          currentPeriodEnd,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        },
      });

      if (updated.count === 0) {
        const metadataUserId = subscription.metadata?.userId;
        if (metadataUserId) {
          const tierByMetadata: Record<string, SubscriptionTier> = {
            "1": SubscriptionTier.TIER1,
            "2": SubscriptionTier.TIER2,
            "3": SubscriptionTier.TIER3,
            TIER1: SubscriptionTier.TIER1,
            TIER2: SubscriptionTier.TIER2,
            TIER3: SubscriptionTier.TIER3,
          };
          const fallbackTier =
            subscriptionTier ??
            tierByMetadata[subscription.metadata?.tier ?? ""] ??
            SubscriptionTier.TIER1;

          await prisma.subscription.upsert({
            where: { userId: metadataUserId },
            create: {
              userId: metadataUserId,
              tier: fallbackTier,
              status: SubscriptionStatus.ACTIVE,
              stripeCustomerId: customer,
              stripeSubscriptionId: subscription.id,
              stripePriceId,
              currentPeriodStart,
              currentPeriodEnd,
              cancelAtPeriodEnd: subscription.cancel_at_period_end,
            },
            update: {
              tier: fallbackTier,
              status: SubscriptionStatus.ACTIVE,
              stripeCustomerId: customer,
              stripeSubscriptionId: subscription.id,
              stripePriceId,
              currentPeriodStart,
              currentPeriodEnd,
              cancelAtPeriodEnd: subscription.cancel_at_period_end,
            },
          });
        }
      }

      const subscriptionRecord = await prisma.subscription.findUnique({
        where: { stripeCustomerId: customer },
        include: { user: true },
      });

      if (subscriptionRecord?.user?.email) {
        const priceId = subscription.items.data[0]?.price.id ?? "";
        const tierMap: Record<string, string> = {
          [process.env.STRIPE_PRICE_STARTER!]: "Starter",
          [process.env.STRIPE_PRICE_GROWTH!]: "Growth",
          [process.env.STRIPE_PRICE_PRO!]: "Pro",
        };
        const tierName = tierMap[priceId] ?? "your plan";

        try {
          await sendEmail({
            to: subscriptionRecord.user.email,
            subject: "Your RelayWeb subscription is active",
            html: subscriptionActivatedEmail(
              subscriptionRecord.user.name ?? "there",
              tierName
            ),
          });
        } catch (e) {
          console.error("[Stripe] Subscription activated email failed:", e);
        }
      }

      break;
    }

    case "customer.subscription.updated": {
      const stripeSubscription =
        event.data.object as StripeSubscriptionWithPeriods;
      const stripeSubscriptionId = stripeSubscription.id;
      const { currentPeriodStart, currentPeriodEnd } =
        resolveSubscriptionPeriods(stripeSubscription);

      const statusMap: Record<string, SubscriptionStatus> = {
        active: SubscriptionStatus.ACTIVE,
        canceled: SubscriptionStatus.CANCELLED,
        past_due: SubscriptionStatus.PAST_DUE,
        trialing: SubscriptionStatus.TRIALING,
      };
      const status =
        statusMap[stripeSubscription.status] ?? SubscriptionStatus.INACTIVE;

      await prisma.subscription.updateMany({
        where: { stripeSubscriptionId },
        data: {
          status,
          currentPeriodStart,
          currentPeriodEnd,
          cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
        },
      });
      break;
    }

    case "customer.subscription.deleted": {
      const stripeSubscription = event.data.object as Stripe.Subscription;
      await prisma.subscription.updateMany({
        where: { stripeSubscriptionId: stripeSubscription.id },
        data: {
          status: SubscriptionStatus.CANCELLED,
          cancelAtPeriodEnd: false,
        },
      });
      break;
    }

    case "invoice.payment_succeeded": {
      const invoice = event.data.object as StripeInvoiceWithSubscription;
      const stripeSubscriptionId = invoice.subscription as string;
      const { currentPeriodStart, currentPeriodEnd } =
        resolveInvoicePeriods(invoice);
      if (stripeSubscriptionId) {
        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId },
          data: {
            status: SubscriptionStatus.ACTIVE,
            currentPeriodStart,
            currentPeriodEnd,
          },
        });
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as StripeInvoiceWithSubscription;
      const stripeSubscriptionId = invoice.subscription as string;
      if (stripeSubscriptionId) {
        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId },
          data: { status: SubscriptionStatus.PAST_DUE },
        });

        const subscription = await prisma.subscription.findFirst({
          where: { stripeSubscriptionId },
          include: { user: true },
        });
        if (subscription?.user?.email) {
          sendPaymentFailedEmail(
            subscription.user.email,
            subscription.user.name ?? "there"
          ).catch(console.error);
        }
      }
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
