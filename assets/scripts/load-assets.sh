#!/usr/bin/env bash
# =============================================================================
# load-assets.sh — Bulk-load Agent Instructions and Custom Agents
#
# Usage:
#   ./assets/scripts/load-assets.sh <agent-space-id> [--region us-east-1]
#
# Prerequisites:
#   - AWS CLI v2 configured with credentials that have aidevops:* permissions
#   - Agent Space already deployed via CDK
#
# This script uploads:
#   1. Global instructions (AGENTS-global.md → all agents)
#   2. Agent-specific instructions (incident-triage, incident-rca, chat)
#   3. Custom agent definitions
# =============================================================================

set -euo pipefail

AGENT_SPACE_ID="${1:?Usage: $0 <agent-space-id> [--region us-east-1]}"
REGION="${3:-us-east-1}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ASSETS_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== AWS DevOps Agent — Asset Loader ==="
echo "Agent Space: $AGENT_SPACE_ID"
echo "Region: $REGION"
echo "Assets Dir: $ASSETS_DIR"
echo ""

# --------------------------------------------------------------------------
# Helper: Upload an AGENTS.md instruction file
# --------------------------------------------------------------------------
upload_instructions() {
  local file="$1"
  local agent_type="$2"
  local content
  content=$(cat "$file")

  echo "  → Uploading instructions: $agent_type ($(wc -l < "$file") lines)"

  aws devops-agent create-asset \
    --region "$REGION" \
    --agent-space-id "$AGENT_SPACE_ID" \
    --asset-type "agents_md" \
    --metadata "{\"agent_type\": \"$agent_type\"}" \
    --content "{\"file\":{\"path\":\"AGENTS.md\",\"body\":{\"text\":$(jq -Rs . < "$file")}}}" \
    --no-cli-pager 2>/dev/null || \
  aws devops-agent update-asset \
    --region "$REGION" \
    --agent-space-id "$AGENT_SPACE_ID" \
    --asset-type "agents_md" \
    --asset-id "$agent_type" \
    --content "{\"file\":{\"path\":\"AGENTS.md\",\"body\":{\"text\":$(jq -Rs . < "$file")}}}" \
    --no-cli-pager 2>/dev/null || \
  echo "    ⚠️  Could not upload (may already exist or API differs). Upload manually via Console."
}

# --------------------------------------------------------------------------
# Helper: Upload a custom agent definition
# --------------------------------------------------------------------------
upload_custom_agent() {
  local file="$1"
  local name
  name=$(jq -r '.name' "$file")
  local metadata
  metadata=$(jq -c '.metadata' "$file")

  echo "  → Creating custom agent: $name"

  aws devops-agent create-asset \
    --region "$REGION" \
    --agent-space-id "$AGENT_SPACE_ID" \
    --asset-type "custom_agent" \
    --metadata "$metadata" \
    --content "{\"file\":{\"path\":\"config.json\",\"body\":{\"text\":$(jq -c '.' "$file" | jq -Rs .)}}}" \
    --no-cli-pager 2>/dev/null || \
  echo "    ⚠️  Could not create (may already exist). Check via Console."
}

# --------------------------------------------------------------------------
# 1. Upload Agent Instructions
# --------------------------------------------------------------------------
echo "📋 Loading Agent Instructions..."
echo ""

if [[ -f "$ASSETS_DIR/instructions/AGENTS-global.md" ]]; then
  upload_instructions "$ASSETS_DIR/instructions/AGENTS-global.md" "GENERIC"
fi

if [[ -f "$ASSETS_DIR/instructions/AGENTS-incident-triage.md" ]]; then
  upload_instructions "$ASSETS_DIR/instructions/AGENTS-incident-triage.md" "INCIDENT_TRIAGE"
fi

if [[ -f "$ASSETS_DIR/instructions/AGENTS-incident-rca.md" ]]; then
  upload_instructions "$ASSETS_DIR/instructions/AGENTS-incident-rca.md" "INCIDENT_RCA"
fi

if [[ -f "$ASSETS_DIR/instructions/AGENTS-chat.md" ]]; then
  upload_instructions "$ASSETS_DIR/instructions/AGENTS-chat.md" "CHAT"
fi

if [[ -f "$ASSETS_DIR/instructions/AGENTS-evaluation.md" ]]; then
  upload_instructions "$ASSETS_DIR/instructions/AGENTS-evaluation.md" "PREVENTION"
fi

echo ""

# --------------------------------------------------------------------------
# 2. Upload Custom Agents
# --------------------------------------------------------------------------
echo "🤖 Loading Custom Agents..."
echo ""

for agent_file in "$ASSETS_DIR/custom-agents"/*.json; do
  [[ -f "$agent_file" ]] && upload_custom_agent "$agent_file"
done

echo ""
echo "✅ Asset loading complete."
echo ""
echo "Next steps:"
echo "  1. Verify in Console → Agent Space → Knowledge → Instructions"
echo "  2. Import skills from GitHub: skills/ directory"
echo "  3. Upload attachments (architecture diagrams) via Console"
