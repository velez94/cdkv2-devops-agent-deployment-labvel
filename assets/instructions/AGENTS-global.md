<!-- version: 1.0.0 | last-updated: 2026-08-05 | author: platform-team -->
# Agent Instructions — Global (All Agents)

## Organization Context

- **Products**: Bank4Us (core banking, Tier 1), Kora (platform services, Tier 2)
- **Landing Zone**: AWS Organizations with Control Tower
- **Hosting Account**: aws-operations-products-sophos (031254713609)
- **Pipeline Tool**: Azure DevOps (repos, builds, deployments)
- **Ticketing**: Jira (project: OPS for incidents, project: PLAT for infra)
- **Observability**: Amazon CloudWatch (metrics, logs, alarms, X-Ray)

## Production Accounts

- Bank4Us Prod: aws-prod-bank4us-product-sophos (872865219972) — us-east-1
- Kora Prod: aws-prod-bank4us-kora-product-gft (147853513076) — us-east-1

## Investigation Approach

- Always check recent deployments (last 24h) before proposing a root cause.
- Correlate alarms across all monitored accounts, not just the alarming one.
- Check both the workload account and the DevSecOps account for pipeline context.
- Use the MCP server tools to query Azure DevOps pipeline status and build logs.

## Response Format

- Lead with a one-sentence summary of findings before listing details.
- Include the AWS account ID and region for any resource you reference.
- Use bullet points for lists of findings or recommendations.
- For incidents: always include blast radius assessment (which modules/users affected).
- For recommendations: include agent-ready implementation specs when possible.

## Escalation Policy

- P1 (Critical): Immediately share findings. Page on-call if no response in 5 minutes.
- P2 (High): Share findings within 15 minutes. Post to incident channel.
- P3 (Medium): Share findings within 1 hour. Update Jira ticket.
- P4 (Low): Add to daily health report. No immediate action required.

## Security

- Never log, display, or suggest storing credentials or secrets in plaintext.
- When recommending IAM changes, follow least-privilege principles.
- Never suggest modifications to production resources directly — always recommend IaC changes.
- Reference infrastructure changes as CDK code modifications, not console actions.

## Tagging Context

Resources are tagged with:
- `Product`: alpha | beta
- `Module`: core-banking | api-gateway | data-lake | web-portal | platform | integrations | analytics
- `Environment`: dev | test | qa | prod
- `Team`: alpha-backend | alpha-frontend | alpha-data | beta-platform
