# Project Structure

CDKv2 TypeScript blueprint for AWS DevOps Agent enterprise deployment.

## Layout
- `bin/` - CDK app entry point
- `lib/stacks/` - Stack definitions (foundation, agent, platform, application)
- `lib/constructs/` - Reusable L2-like CDK constructs for DevOps Agent
- `skills/` - DevOps Agent Skills (SKILL.md format, imported via GitHub)
- `assets/` - Agent Instructions, custom agents, attachments, load scripts
- `app/functions/` - Lambda function source code
- `project_configs/` - YAML-driven environment configuration
- `test/` - Jest tests (assertions + cdk-nag + snapshots)
- `docs/catalog/` - Backstage catalog and documentation
- `.kiro/agents/` - Kiro IDE agent definitions (thoth, devops-agent)

## Conventions
- One stack per domain concern (foundation → agent → platform → application)
- Constructs are reusable, stacks compose them
- Environment config externalized in YAML (`project_configs/`)
- cdk-nag AwsSolutions pack enabled by default
- S3 buckets: encryption, SSL, public access blocked
- Agent Instructions versioned with semantic versioning (see `assets/VERSIONING.md`)
- Skills follow official SKILL.md format with frontmatter

## Stack Layers

```
Foundation  → Core resources (S3, KMS, IAM baselines)
Agent       → AWS DevOps Agent (Agent Space, Associations, MCP, Private Connections)
Platform    → Shared infra (VPC, ECS, API Gateway)
Application → Workload resources (Lambda, DynamoDB)
```

## DevOps Agent Resources

```
Agent Space (CfnAgentSpace)
├── KMS CMK (encryption at rest, auto-rotation)
├── Agent Access Role (AIDevOpsAgentAccessPolicy + Resource Explorer SLR)
├── Operator App Role (AIDevOpsOperatorAppAccessPolicy)
├── SourceAws Association (hosting account itself)
├── Aws Associations (remote monitored accounts)
├── MCP Services (CfnService → CfnAssociation)
└── Private Connections (CfnPrivateConnection → service-managed Resource Gateway)
```

## Prerequisites (not in this repo)

| Resource | Managed By | Pipeline |
|----------|-----------|----------|
| DevOpsAgentAccessRole (all accounts) | Platform team | StackSet |
| Permission Sets (Identity Center) | Platform team | cdkv2_sso_delegated_management |
| AWS Support plan (hosting account) | Platform team | Manual |
| VPC/networking for private connections | Platform team | Networking pipeline |
