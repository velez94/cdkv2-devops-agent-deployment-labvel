# CDKv2 Versioning Guide

## Version Format

```
vMAJOR.MINOR.PATCH
```

All tags MUST be annotated (`git tag -a`) and prefixed with `v`.

## Decision Matrix

### MAJOR (Breaking / Framework)

| Change | Example | Why MAJOR |
|--------|---------|-----------|
| Add environment | Add `stg` to environment_options.yaml | Deployment matrix changes |
| Remove environment | Remove `qa` from config | Reduces deployment targets |
| Modify config-loader interface | Change ProjectConfig type | All stacks affected |
| Modify app entry point pattern | Change how stacks are instantiated in bin/ | All stacks affected |
| CDK major upgrade | aws-cdk-lib 2.x → 3.x | Potential construct migration |
| Change cdk-nag pack | AwsSolutions → HIPAA | Different compliance rules |
| Change directory convention | Rename lib/stacks/ to infra/ | All imports break |

### MINOR (Capability)

| Change | Example | Why MINOR |
|--------|---------|-----------|
| Add new stack | Create lib/stacks/platform/data-stack.ts | New capability |
| Remove unused stack | Delete unused application stack | Capability removed |
| Add construct | New reusable construct in lib/constructs/ | New building block |
| Add Lambda function | New function in app/functions/ | New capability |
| Add resources to stack | Add DynamoDB table to existing stack | Stack expanded |
| New stack props | Add optional configuration to stack | More flexibility |

### PATCH (Fixes / Settings)

| Change | Example | Why PATCH |
|--------|---------|-----------|
| Fix construct config | Correct S3 bucket encryption setting | Bug fix |
| cdk-nag suppression | Add NagSuppressions with justification | Compliance tuning |
| Config value change | Update dev account ID in YAML | Environment tuning |
| Dependency bump | aws-cdk-lib 2.148.0 → 2.150.0 | Patch update |
| Test fix | Correct assertion in stack test | No infra change |
| Documentation | Update README | No infra change |

## Tagging Workflow

```bash
CURRENT=$(git tag --sort=-v:refname | head -1)
git log $CURRENT..HEAD --oneline
# Apply decision matrix
git tag -a v1.2.0 -m "feat(platform): add RDS construct for managed databases"
git push --tags
```
