#!/usr/bin/env bash
# deploy.sh — build and deploy the AI Scheduler backend via AWS SAM
# Usage: ./scripts/deploy.sh [dev|prod]
set -euo pipefail

STAGE="${1:-prod}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/../backend"

# ── Colours ────────────────────────────────────────────────────────────────────
GREEN="\033[0;32m"; YELLOW="\033[0;33m"; CYAN="\033[0;36m"; RESET="\033[0m"
info()    { echo -e "${CYAN}[info]${RESET}  $*"; }
success() { echo -e "${GREEN}[ok]${RESET}    $*"; }
prompt()  { echo -e "${YELLOW}[input]${RESET} $*"; }

# ── Pre-flight checks ──────────────────────────────────────────────────────────
info "Checking prerequisites..."

for cmd in aws sam node npm; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "ERROR: '$cmd' not found. Please install it and re-run."
    exit 1
  fi
done

AWS_IDENTITY=$(aws sts get-caller-identity --query "Arn" --output text 2>/dev/null || echo "")
if [[ -z "$AWS_IDENTITY" ]]; then
  echo "ERROR: AWS credentials not configured. Run 'aws configure' first."
  exit 1
fi
success "AWS identity: $AWS_IDENTITY"

# ── Collect secrets ────────────────────────────────────────────────────────────
echo ""
info "Enter deployment parameters (secrets are hidden and never written to disk)."
echo ""

prompt "Stage [$STAGE]:"
read -r INPUT_STAGE
STAGE="${INPUT_STAGE:-$STAGE}"

prompt "CoachId (e.g. coach-001):"
read -r COACH_ID

prompt "TwilioAccountSid (starts with AC…):"
read -rs TWILIO_ACCOUNT_SID; echo ""

prompt "TwilioAuthToken:"
read -rs TWILIO_AUTH_TOKEN; echo ""

prompt "TwilioPhoneNumber (E.164, e.g. +14155551234):"
read -r TWILIO_PHONE_NUMBER

prompt "AnthropicApiKey (sk-ant-…):"
read -rs ANTHROPIC_API_KEY; echo ""

prompt "FrontendOrigin for CORS (press Enter to allow all — use * for now):"
read -r FRONTEND_ORIGIN
FRONTEND_ORIGIN="${FRONTEND_ORIGIN:-*}"

echo ""
info "WebhookUrl: leave blank on first deploy (you'll get the URL from Outputs)."
prompt "WebhookUrl (press Enter to skip):"
read -r WEBHOOK_URL
WEBHOOK_URL="${WEBHOOK_URL:-}"

# ── Build ──────────────────────────────────────────────────────────────────────
echo ""
info "Installing backend dependencies..."
(cd "$BACKEND_DIR" && npm install --prefer-offline 2>&1 | tail -2)

info "Running SAM build (esbuild)..."
(cd "$BACKEND_DIR" && sam build --config-env "$STAGE" 2>&1)
success "Build complete."

# ── Deploy ─────────────────────────────────────────────────────────────────────
info "Deploying stack ai-scheduler-${STAGE} to AWS..."

PARAM_OVERRIDES=(
  "Stage=${STAGE}"
  "CoachId=${COACH_ID}"
  "TwilioAccountSid=${TWILIO_ACCOUNT_SID}"
  "TwilioAuthToken=${TWILIO_AUTH_TOKEN}"
  "TwilioPhoneNumber=${TWILIO_PHONE_NUMBER}"
  "AnthropicApiKey=${ANTHROPIC_API_KEY}"
  "FrontendOrigin=${FRONTEND_ORIGIN}"
)

if [[ -n "$WEBHOOK_URL" ]]; then
  PARAM_OVERRIDES+=("WebhookUrl=${WEBHOOK_URL}")
fi

(
  cd "$BACKEND_DIR"
  sam deploy \
    --config-env "$STAGE" \
    --parameter-overrides "${PARAM_OVERRIDES[@]}"
)

# ── Print outputs ──────────────────────────────────────────────────────────────
echo ""
success "Deployment complete! Stack outputs:"
echo ""
aws cloudformation describe-stacks \
  --stack-name "ai-scheduler-${STAGE}" \
  --query "Stacks[0].Outputs[*].[OutputKey,OutputValue]" \
  --output table

echo ""
info "Next steps:"
echo "  1. Copy the WebhookUrl above → paste into Twilio console (Messaging → Active Numbers → Webhooks)"
echo "  2. Re-run this script with the WebhookUrl to update the Lambda env var"
echo "  3. Copy the ApiUrl above → set as NEXT_PUBLIC_API_URL in frontend/.env.local"
echo ""
