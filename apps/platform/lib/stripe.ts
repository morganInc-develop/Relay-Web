import Stripe from "stripe";

const globalForStripe = globalThis as unknown as {
  stripe: Stripe | undefined;
};

const stripe =
  globalForStripe.stripe ??
  new Stripe(process.env.STRIPE_SECRET_KEY ?? "");

if (process.env.NODE_ENV !== "production") {
  globalForStripe.stripe = stripe;
}

export { stripe };
