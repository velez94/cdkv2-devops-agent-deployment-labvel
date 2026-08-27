# Technology Stack

- **IaC**: AWS CDK v2 (TypeScript)
- **Language**: TypeScript 5.9 (ES2022 target, CommonJS modules)
- **Testing**: Jest 30 with ts-jest
- **Security**: cdk-nag 3.x with AwsSolutions checks
- **Linting**: ESLint 9 + Prettier 3
- **Config**: YAML-based environment configuration
- **CI/CD**: GitHub Actions (lint → synth → security scan → deploy)
- **Documentation**: Zensical (static site generator)

## AWS Services

- **AWS DevOps Agent** — Agent Spaces, Skills, Instructions, Associations
- **AWS KMS** — Customer-managed keys for Agent Space encryption
- **AWS IAM** — Agent Access Role, Operator Role (managed policies)
- **IAM Identity Center** — User access to Agent Space operator web app
- **Amazon CloudWatch** — Native observability integration (built-in)

## CloudFormation Resource Types

- `AWS::DevOpsAgent::AgentSpace` — Agent Space container
- `AWS::DevOpsAgent::Association` — Service-to-space bindings (SourceAws, Aws, MCP)
- `AWS::DevOpsAgent::Service` — Register external services (MCP, Dynatrace, GitLab)
- `AWS::DevOpsAgent::PrivateConnection` — VPC private connectivity

## External Integrations

- **Azure DevOps** — ALM, CI/CD pipelines (OAuth, console-only)
- **Jira** — Service management, incident ticketing (Event Channel webhook)
- **Kiro IDE** — Developer workflow via MCP/A2A protocol
- **Custom MCP Servers** — Private connection to DevSecOps VPC

## Agent Knowledge Model

- **Skills** (`skills/`) — On-demand investigation procedures (SKILL.md + frontmatter)
- **Instructions** (`assets/instructions/`) — Always-on guidance (AGENTS.md per agent type)
- **Attachments** (`assets/attachments/`) — Architecture diagrams, reference PDFs
- **Custom Agents** (`assets/custom-agents/`) — Scheduled/scoped agent definitions
