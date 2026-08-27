# Product Context

Enterprise CDK blueprint for deploying AWS DevOps Agent infrastructure across a multi-product, multi-account AWS Landing Zone.

## Goals
- Provision Agent Spaces with enterprise security (KMS, Identity Center, least-privilege IAM)
- Enable multi-account observability (9+ accounts per product)
- Connect custom MCP servers via private connections (no internet traversal)
- Integrate with Azure DevOps (ALM/CI/CD), Jira (ticketing), CloudWatch (observability)
- Provide version-controlled Agent Instructions and Skills alongside infrastructure
- Support Kiro IDE integration via MCP/A2A protocol

## Products Monitored
- **Bank4Us (Alpha)** — Core banking, API Gateway, Data Lake, Web Portal (Tier 1)
- **Kora (Beta)** — Platform Services, Integrations, Analytics (Tier 2)

## Key Decisions
- 1 Agent Space per product (blast radius isolation)
- Hosting account: operations account with Business Support+ (credits)
- Cross-account access via StackSet-deployed IAM roles (prerequisite)
- User access via Identity Center permission sets (separate pipeline)
- Skills stored in this repo, imported to Agent Space via GitHub URL
- Agent Instructions versioned with semantic versioning

## Stakeholders
- **Platform team** — Owns StackSets, permission sets, networking
- **SRE / SecOps** — Owns Agent Space deployment, skills, operations
- **Security Officer** — Approves IAM roles, administers agent config
- **Developers** — Read-only access to investigation findings
