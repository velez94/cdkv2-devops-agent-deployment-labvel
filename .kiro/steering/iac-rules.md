# IaC Rules

## CDK Best Practices
- Use L2/L3 constructs over L1 (Cfn*) when available
- Enable encryption at rest for all storage resources
- Enforce SSL/TLS for data in transit
- Block public access on S3 buckets by default
- Use RemovalPolicy.RETAIN for production stateful resources
- Tag all resources: Project, Environment, Owner, ManagedBy
- Run cdk-nag AwsSolutions checks on every synth

## AWS DevOps Agent Rules

### IAM Roles (aligned with official CDK guide)
- Agent Access Role MUST use `AIDevOpsAgentAccessPolicy` managed policy
- Operator App Role MUST use `AIDevOpsOperatorAppAccessPolicy` managed policy
- Trust policy MUST include `aws:SourceAccount` condition
- Resource Explorer SLR inline policy MUST be attached to Agent Access Role
- Cross-account roles (StackSet) MUST include explicit Deny on mutations

### Associations
- Hosting account MUST have a `SourceAws` association (accountType: 'source')
- Remote accounts use `Aws` association (accountType: 'monitor')
- Both sides of the trust MUST exist before the agent can investigate

### MCP / Private Connections
- OAuth services (GitHub, Slack, Datadog) CANNOT be provisioned via CDK — console only
- MCP servers in VPC MUST use Private Connections (no public internet)
- Private Connection names: lowercase, alphanumeric, hyphens, 3-30 chars

### Skills & Instructions
- Skills follow SKILL.md format with frontmatter (name + description required)
- Agent Instructions are plain markdown, no frontmatter, max 25 KB
- All prompts versioned with semantic versioning (`assets/VERSIONING.md`)
- Skills imported via GitHub URL, instructions loaded via `load-assets.sh`

## cdk-nag v3 (IMPORTANT)

This project uses cdk-nag v3 which has a completely different suppression API from v2.

### Instantiation (v3)
```typescript
// v3: instantiate with scope directly — NO Aspects.of().add()
new AwsSolutionsChecks(app, { verbose: true });
```

### Acknowledging (suppressing) rule violations (v3)
```typescript
import { Validations } from 'aws-cdk-lib';

// Acknowledge a specific rule on a construct
Validations.of(myBucket).acknowledge({
  id: 'AwsSolutions-S1',
  reason: 'Access logs bucket does not need its own access logs',
});

// Acknowledge a finding with specific resource/action
Validations.of(myRole).acknowledge({
  id: 'AwsSolutions-IAM5[Action::s3:*]',
  reason: 'Requires broad S3 access for data pipeline',
});

// Stack-level acknowledgment
Validations.of(stack).acknowledge({
  id: 'AwsSolutions-S10',
  reason: 'Internal bucket, SSL not required for VPC-only access',
});
```

### REMOVED APIs (do NOT use)
- ~~`NagSuppressions.addResourceSuppressions()`~~ → use `Validations.of().acknowledge()`
- ~~`NagSuppressions.addStackSuppressions()`~~ → use `Validations.of().acknowledge()`
- ~~`NagSuppressions.addResourceSuppressionsByPath()`~~ → use `Validations.of().acknowledge()`
- ~~`appliesTo: ['Action::s3:*']`~~ → use `id: 'AwsSolutions-IAM5[Action::s3:*]'`
- ~~`NagPackSuppression` interface~~ → removed entirely

### Key difference from v2
Each finding must be acknowledged individually. `AwsSolutions-IAM5[Action::s3:*]` and `AwsSolutions-IAM5[Resource::*]` are **separate** acknowledgments.

## Naming
- Stack IDs: `{ProjectName}-{Domain}-{Environment}`
- Construct IDs: PascalCase
- Config files: kebab-case YAML
