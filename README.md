# cdkv2-devops-agent-deployment-labvel

> AWS DevOps Agent deployment using CDK v2 — Hub model with multi-account cross-account monitoring.

## Architecture

This blueprint follows the **AWS best practice** of deploying Agent Spaces in an operations (DevSecOps) account as a hub, with lightweight IAM roles in target workload accounts.

```
┌─────────────────────────────────────────────────────────────────────────┐
│ DevSecOps / Pipeline Account (Operations Hub)                           │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ CDK Pipeline (self-mutating, CodeConnections → GitHub)           │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌────────────────────────────┐  ┌────────────────────────────────┐   │
│  │ Agent Space: NonProd       │  │ Agent Space: Prod              │   │
│  │                            │  │                                │   │
│  │ • KMS CMK (encryption)     │  │ • KMS CMK (encryption)        │   │
│  │ • Agent Access Role        │  │ • Agent Access Role            │   │
│  │ • Operator Role            │  │ • Operator Role                │   │
│  │ • Monitors: dev + qa       │  │ • Monitors: prd               │   │
│  └────────────────────────────┘  └────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
         │ Cross-account deploy (CDK Pipelines)
         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Target Accounts (Workloads)                                             │
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────────┐ │
│  │  dev account │  │  qa account  │  │  prd account                 │ │
│  │              │  │              │  │                              │ │
│  │  IAM Role:   │  │  IAM Role:   │  │  IAM Role:                  │ │
│  │  DevOpsAgent │  │  DevOpsAgent │  │  DevOpsAgentAccessRole      │ │
│  │  AccessRole  │  │  AccessRole  │  │  -devops-agent-prod         │ │
│  │  -devops-    │  │  -devops-    │  │                              │ │
│  │  agent-      │  │  agent-      │  │  (assumed by aidevops svc)   │ │
│  │  nonprod     │  │  nonprod     │  │                              │ │
│  └──────────────┘  └──────────────┘  └──────────────────────────────┘ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Hub model** (Agent Spaces in operations account) | Centralized management, single pane of glass per on-call tier |
| **Two spaces** (NonProd + Prod) | AWS best practice: one Agent Space per on-call team, separate prod from non-prod |
| **Lightweight target stacks** | Minimizes blast radius — target accounts only get an IAM role |
| **CDK Pipelines** | Self-mutating, cross-account, infrastructure as code delivery |

## Project Structure

```
bin/                              CDK app entry point
lib/
├── stacks/
│   ├── agent/
│   │   ├── devops-agent-stack.ts       Agent Space (hub deployment)
│   │   └── agent-access-role-stack.ts  Cross-account IAM role (target accounts)
│   └── pipeline/
│       ├── pipeline-stack.ts           Self-mutating CodePipeline
│       └── deploy-stage.ts            CDK Pipelines stage (deploys IAM role)
├── constructs/
│   ├── devops-agent-space.ts           L2-like construct: Agent Space + roles
│   ├── devops-agent-aws-association.ts Cross-account associations
│   ├── devops-agent-mcp-service.ts     MCP server integrations
│   └── devops-agent-private-connection.ts VPC connectivity
project_configs/
│   ├── environment_options.yaml        All configuration (accounts, spaces)
│   └── config-loader.ts               YAML → TypeScript config loader
skills/                               DevOps Agent Skills (SKILL.md format)
test/                                 CDK assertions + cdk-nag + snapshots
```

## Prerequisites

### 1. CDK Bootstrap

All accounts must be CDK-bootstrapped. Target accounts need `--trust` to the pipeline account:

```bash
# Pipeline account (self-bootstrap)
npx cdk bootstrap aws://PIPELINE_ACCOUNT/us-east-1 \
  --profile <devsecops-profile>

# Target accounts (trust the pipeline account)
npx cdk bootstrap aws://TARGET_ACCOUNT/us-east-1 \
  --trust PIPELINE_ACCOUNT \
  --cloudformation-execution-policies arn:aws:iam::aws:policy/AdministratorAccess \
  --profile <target-profile>
```

### 2. CodeConnections

Create an AWS CodeConnections connection in the pipeline account:
- Console → Developer Tools → Settings → Connections → Create connection
- Complete the OAuth handshake with your VCS provider (GitHub)
- Connection must be in `AVAILABLE` status

### 3. First Deployment

```bash
npx cdk deploy "*-Pipeline" --profile <devsecops-profile>
```

After this, the pipeline self-mutates on every `git push` to main.

## Configuration

All configuration lives in `project_configs/environment_options.yaml`:

```yaml
# Accounts and regions
environments:
  dev:
    account: "111111111111"
    region: "us-east-1"
  qa:
    account: "222222222222"
    region: "us-east-1"
  prd:
    account: "333333333333"
    region: "us-east-1"

# Agent Spaces (deployed in pipeline account)
agent_spaces:
  - name: "my-app-nonprod"
    description: "NonProd Agent Space"
    tier: "nonprod"
    monitored_accounts:
      - environment: dev
        account_id: "111111111111"
        regions: ["us-east-1"]
      - environment: qa
        account_id: "222222222222"
        regions: ["us-east-1"]

  - name: "my-app-prod"
    description: "Prod Agent Space"
    tier: "prod"
    monitored_accounts:
      - environment: prd
        account_id: "333333333333"
        regions: ["us-east-1"]
```

### Optional Integrations

```yaml
# MCP server integrations (Splunk, Grafana, custom)
mcp_servers:
  - service_type: "mcpserver"
    name: "custom-runbooks"
    target_url: "https://mcp.internal.example.com"
    private_connection_name: "internal-mcp"

# VPC connectivity for MCP servers
private_connection:
  name: "internalmcp"
  host_address: "10.0.1.50"
  vpc_id: "vpc-0123456789abcdef0"
  subnet_ids: ["subnet-aaa", "subnet-bbb"]
  security_group_ids: ["sg-111"]

# Identity Center (instead of IAM auth for operator web app)
use_identity_center: true
identity_center_instance_arn: "arn:aws:sso:::instance/ssoins-..."
```

> **Note**: OAuth-based integrations (GitHub, Slack, Datadog, Jira) must be configured via the AWS Console.

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests (includes cdk-nag compliance)
npm test

# Synthesize
npx cdk synth

# Direct deploy mode (without pipeline)
# Deploy Agent Spaces to hub account:
npx cdk deploy --all --context target=agent-space --profile <devsecops-profile>

# Deploy IAM role to a target account:
npx cdk deploy --all --context target=access-role --context env=dev --profile <dev-profile>
```

## Security & Compliance

- **cdk-nag**: AwsSolutions checks run on every synthesis
- **KMS encryption**: Agent Space data encrypted with dedicated CMK per space
- **Key rotation**: Enabled by default on all KMS keys
- **Least privilege**: Agent assumes read-only role (`AIDevOpsAgentAccessPolicy`)
- **Cross-account trust**: Scoped to `aidevops.amazonaws.com` with `SourceAccount` condition
- **Separation of concerns**: Prod and NonProd Agent Spaces are fully isolated
- **Tagging**: Mandatory tags (Project, Environment, Owner, ManagedBy)

## CI/CD Pipeline

Self-mutating CDK Pipeline (AWS CodePipeline):

```
Source (GitHub) → Synth (Node 20 + npm ci + build + test + cdk synth)
                      → SelfMutate (updates pipeline if changed)
                      → Deploy-dev (AgentAccessRole → dev account)
                      → [Manual Approval] → Deploy-qa (AgentAccessRole → qa account)
                      → [Manual Approval] → Deploy-prd (AgentAccessRole → prd account)
```

Agent Spaces deploy as nested stacks within the pipeline stack itself (same account).

## References

- [AWS DevOps Agent Documentation](https://docs.aws.amazon.com/devopsagent/latest/userguide/)
- [Best Practices for Deploying AWS DevOps Agent in Production](https://aws.amazon.com/blogs/devops/best-practices-for-deploying-aws-devops-agent-in-production/)
- [Getting Started with AWS DevOps Agent using AWS CDK](https://docs.aws.amazon.com/devopsagent/latest/userguide/getting-started-with-aws-devops-agent-getting-started-with-aws-devops-agent-using-aws-cdk.html)
- [AWS CDK Pipelines](https://docs.aws.amazon.com/cdk/v2/guide/cdk_pipeline.html)

## License

Apache-2.0
