#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env.local"
FORWARD_URL="${1:-http://localhost:3000/api/stripe/webhook}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE"
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

if [[ -z "${STRIPE_SECRET_KEY:-}" ]]; then
  echo "STRIPE_SECRET_KEY is missing in $ENV_FILE"
  exit 1
fi

WEBHOOK_SECRET="$(
  stripe listen \
    --api-key "$STRIPE_SECRET_KEY" \
    --forward-to "$FORWARD_URL" \
    --print-secret
)"

if [[ -z "$WEBHOOK_SECRET" ]]; then
  echo "Could not resolve Stripe webhook signing secret."
  exit 1
fi

TMP_FILE="$(mktemp)"
awk -v secret="$WEBHOOK_SECRET" '
BEGIN { found = 0 }
/^STRIPE_WEBHOOK_SECRET=/ {
  print "STRIPE_WEBHOOK_SECRET=" secret
  found = 1
  next
}
{ print }
END {
  if (!found) {
    print "STRIPE_WEBHOOK_SECRET=" secret
  }
}
' "$ENV_FILE" > "$TMP_FILE"
mv "$TMP_FILE" "$ENV_FILE"

echo "Synced STRIPE_WEBHOOK_SECRET in .env.local"
echo "Forwarding Stripe webhooks to $FORWARD_URL"

exec stripe listen --api-key "$STRIPE_SECRET_KEY" --forward-to "$FORWARD_URL"
