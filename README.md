# devops-agent-blueprint — CDKv2 TypeScript Infrastructure

> Enterprise-grade AWS CDK blueprint with cdk-nag compliance, multi-environment support, and AI-assisted development via ThothForge.

## Architecture

```
bin/                          CDK app entry point
lib/
├── stacks/
│   ├── foundation/           Core resources (S3, KMS, IAM baselines)
│   ├── agent/                AWS DevOps Agent (Agent Space, Associations, MCP)
│   ├── platform/             Shared infra (VPC, ECS, API Gateway)
│   └── application/          Workload resources (Lambda, DynamoDB)
└── constructs/               Reusable L2/L3 constructs
skills/                       DevOps Agent Skills (SKILL.md format)
app/functions/                Lambda function source code
project_configs/              YAML-driven environment configuration
test/                         CDK assertions + cdk-nag + snapshots
docs/catalog/                 Backstage TechDocs
```

## Prerequisites (Supplied by Platform Team)

The following resources must exist **before** deploying this blueprint. They are managed by the `cdkv2_sso_delegated_management` pipeline:

| Resource | Pipeline | Purpose |
|----------|----------|---------|
| Permission Set: `prt_secops_devopsagent_org` | SSO pipeline | SecOps operator access to Agent Space |
| Permission Set: `prt_secops_securityagent_org` | SSO pipeline | Security Agent access |
| Permission Set: `prt_secofficer_agents_adm_org` | SSO pipeline | Agent administration (integrations config) |
| Permission Set: `prt_devs_devopsagent_ro_b4us` | SSO pipeline | Developer read-only access |
| `DevOpsAgentAccessRole` in monitored accounts | StackSet | Cross-account agent access |
| AWS Support plan on hosting account | Manual | Credits for agent compute |

This blueprint deploys the **infrastructure** (Agent Space, KMS, associations, MCP). Access **to** the Agent Space is governed by the SSO pipeline.

## Quick Start

```bash
# Install dependencies
npm install

# Synthesize CloudFormation (dev environment)
npx cdk synth --context env=dev

# Run tests (includes cdk-nag compliance)
npm test

# Deploy to dev
npx cdk deploy --all --context env=dev
```

## Environment Configuration

Edit `project_configs/environment_options.yaml` to configure accounts and regions:

```yaml
environments:
  dev:
    account: "111111111111"
    region: "us-east-1"
  prd:
    account: "333333333333"
    region: "us-east-1"
```

## Security & Compliance

- **cdk-nag**: AwsSolutions checks run on every `cdk synth`
- **Encryption**: All storage resources encrypted at rest (S3, EBS, RDS)
- **SSL/TLS**: Enforced on all data-in-transit paths
- **Public access**: Blocked by default on all S3 buckets
- **Tagging**: Mandatory tags (Project, Environment, Owner, ManagedBy)

## Development

```bash
# Lint
npm run lint

# Format
npm run format

# Watch mode (auto-compile)
npm run watch

# Run specific test
npx jest test/cdk-nag.test.ts
```

## CI/CD Pipeline

GitHub Actions pipeline (`.github/workflows/deploy.yml`):
1. **Lint & Test** — ESLint, Prettier, Jest
2. **Synth** — CDK synth per environment (matrix)
3. **Security Scan** — Checkov on synthesized CloudFormation
4. **Deploy** — CDK deploy to dev (on main push, with OIDC role)

## AI-Assisted Development

This blueprint includes a pre-configured THOTH agent (`.kiro/agents/thoth.json`) with:
- AWS IaC MCP server for CDK best practices
- AWS Knowledge MCP for documentation
- ThothCTL MCP for governance and scanning
- Git MCP for version control

```bash
kiro-cli chat --agent thoth
```

## Stack Layers

| Layer | Purpose | Status |
|-------|---------|--------|
| Foundation | Core resources (S3, KMS, IAM) | ✅ Implemented |
| Agent | AWS DevOps Agent (Agent Space, Associations, MCP) | ✅ Implemented |
| Platform | Shared infra (VPC, ECS, ALB) | 📋 Placeholder |
| Application | Workload resources (Lambda, DDB) | 📋 Placeholder |

## AWS DevOps Agent

The blueprint provisions the full DevOps Agent infrastructure via CDK:

- **Agent Space** — KMS-encrypted, tagged, with operator web app (IAM or Identity Center)
- **AWS Account Associations** — Multi-account monitoring via assumable roles
- **MCP Server Registrations** — Connect custom/proprietary MCP servers (Splunk, New Relic, Grafana, SigV4)
- **Private Connections** — VPC-based connectivity to MCP servers (service-managed Resource Gateway)

Configure in `project_configs/environment_options.yaml`:

```yaml
devops_agent:
  space_name: "my-agent-space"
  monitored_accounts:
    - account_id: "111111111111"
      role_arn: "arn:aws:iam::111111111111:role/DevOpsAgentAccessRole"
      regions: ["us-east-1"]
  mcp_servers:
    - service_type: "mcpserver"
      name: "custom-runbooks"
      target_url: "https://mcp.internal.example.com"
  private_connection:
    name: "internalmcp"
    host_address: "10.0.1.50"
    vpc_id: "vpc-0123456789abcdef0"
    subnet_ids: ["subnet-aaa", "subnet-bbb"]
    security_group_ids: ["sg-111"]
```

> **Note**: OAuth-based integrations (GitHub, Slack, Datadog) must be configured via the AWS Console.

## License

Apache-2.0

## License

Apache-2.0
