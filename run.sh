#!/bin/bash
# TrumpSays – Quick runner
# Usage:
#   ./run.sh                 # analyze + print signals
#   ./run.sh --dashboard     # analyze + open HTML dashboard in browser
#   ./run.sh --email         # analyze + send email digest
#   ./run.sh --dashboard --email   # both

set -e
cd "$(dirname "$0")"

# ── Set your keys here ──────────────────────────────────────────────
export ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-YOUR_API_KEY_HERE}"
export DIGEST_EMAIL="${DIGEST_EMAIL:-aru497@gmail.com}"

# For email sending via Gmail:
# export SMTP_USER="your@gmail.com"
# export SMTP_PASS="your-app-password"   # Gmail App Password (not your regular password)
# ─────────────────────────────────────────────────────────────────────

python3 -m trumpsays.main "$@"
