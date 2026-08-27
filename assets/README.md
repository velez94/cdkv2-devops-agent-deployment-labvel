# DevOps Agent Assets

This directory contains [Agent Instructions](https://docs.aws.amazon.com/devopsagent/latest/userguide/about-aws-devops-agent-agent-instructions.html) and [Assets](https://docs.aws.amazon.com/devopsagent/latest/userguide/about-aws-devops-agent-managing-assets.html) for AWS DevOps Agent.

## Structure

```
assets/
├── instructions/                    Agent Instructions (AGENTS.md files)
│   ├── AGENTS-global.md             → All agents (always loaded, every session)
│   ├── AGENTS-incident-triage.md    → Incident Triage agent only
│   ├── AGENTS-incident-rca.md       → Incident RCA agent only
│   └── AGENTS-chat.md               → Chat (On-demand SRE) agent only
├── custom-agents/                   Custom Agent definitions
│   └── daily-health-report.json     → Scheduled daily ops check
├── attachments/                     Binary assets (diagrams, PDFs)
│   └── (add .png, .pdf files here)
└── scripts/
    └── load-assets.sh               → Bulk-load script (AWS CLI)
```

## Agent Instructions vs Skills

| | Agent Instructions | Skills |
|---|---|---|
| **Loaded** | Always (every session, unconditionally) | On-demand (agent decides based on description) |
| **Purpose** | Standing policies, context, escalation rules | Investigation procedures for specific scenarios |
| **Format** | Markdown only, no frontmatter | SKILL.md with frontmatter + optional references |
| **Quantity** | One per agent type (max) | Up to 200 per Agent Space |
| **Size limit** | 25 KB (recommended: 120 lines) | 6 MB (ZIP bundle) |
| **Location** | `assets/instructions/` | `skills/` |

## Usage

### Bulk-load all instructions + custom agents

```bash
# After deploying the Agent Space via CDK
SPACE_ID=$(aws devops-agent list-agent-spaces --query 'agentSpaces[0].agentSpaceId' --output text)

./assets/scripts/load-assets.sh "$SPACE_ID"
```

### Manual upload via Console

1. Agent Space → Knowledge → **Instructions** tab
2. Select agent type (All agents, Chat, Incident triage, etc.)
3. Paste the content from the corresponding `AGENTS-*.md` file
4. Save

### Upload via AWS CLI (single file)

```bash
aws devops-agent create-asset \
  --agent-space-id "$SPACE_ID" \
  --asset-type "agents_md" \
  --metadata '{"agent_type": "GENERIC"}' \
  --content "{\"file\":{\"path\":\"AGENTS.md\",\"body\":{\"text\":\"$(cat assets/instructions/AGENTS-global.md)\"}}}"
```

## Agent Types Reference

| Agent Type ID | Console Name | Use Case |
|--------------|-------------|----------|
| `GENERIC` | All agents | Global context (always loaded by all) |
| `CHAT` | Chat | On-demand SRE questions |
| `INCIDENT_TRIAGE` | Incident triage | Alarm filtering, severity, routing |
| `INCIDENT_RCA` | Incident RCA | Root cause analysis |
| `INCIDENT_MITIGATION` | Incident mitigation | Remediation steps |
| `PREVENTION` | Evaluation | Proactive recommendations |
| `CHANGE_REVIEW` | Change review | Release readiness (preview) |

## Customization

### Adding environment-specific context

Update `AGENTS-global.md` with:
- New accounts as they're onboarded
- New modules/services
- Updated team routing
- Changed maintenance windows

### Adding a new custom agent

1. Create `custom-agents/<name>.json`:
```json
{
  "name": "my-agent",
  "description": "What this agent does",
  "metadata": {
    "name": "my-agent",
    "tools": ["cloudwatch:GetMetricData"],
    "skills": ["my-skill-name"]
  }
}
```
2. Run `./assets/scripts/load-assets.sh <space-id>`

### Uploading attachments (architecture diagrams)

```bash
# Base64 encode and upload
base64 architecture/devops-agent-enterprise.drawio > /tmp/diagram.b64
aws devops-agent create-asset \
  --agent-space-id "$SPACE_ID" \
  --asset-type "attachment" \
  --metadata '{"filename":"architecture.drawio","extension":"drawio","size":'$(wc -c < architecture/devops-agent-enterprise.drawio)'}' \
  --content "{\"file\":{\"path\":\"architecture.drawio\",\"body\":{\"bytes\":\"$(cat /tmp/diagram.b64)\"}}}"
```
