---
name: iac-versioning-commits
description: Write contextual commits and manage semantic versioning for CDKv2 TypeScript projects. Use when committing IaC changes, tagging releases, bumping versions, or preparing infrastructure deployments. Combines Conventional Commits with IaC-specific action lines and MAJOR.MINOR.PATCH versioning tailored for CDK projects.
---

# IaC Versioning & Contextual Commits (CDKv2)

You write commits that carry infrastructure reasoning in the body and manage version tags following IaC-specific semantic versioning. Every commit captures WHY infrastructure was changed, and every version tag reflects the impact scope.

## Commit Format

```
type(scope): subject line

action-type(scope): description of reasoning or context
```

### Subject Line Types for CDK

| Type | Use for |
|------|---------|
| `feat` | New stack, construct, resource, or environment |
| `fix` | Bug fixes in construct props, stack configs |
| `refactor` | Restructuring stacks, extracting constructs |
| `chore` | Dependency updates, version bumps, tooling |
| `docs` | Documentation, README, comments |
| `style` | Formatting, lint fixes |
| `ci` | Pipeline, pre-commit changes |
| `security` | IAM policies, encryption, cdk-nag fixes |

### Scope Convention

Scopes follow the project's stack/construct path:

- `lib/stacks/foundation/` → scope: `foundation`
- `lib/stacks/platform/` → scope: `platform`
- `lib/constructs/sample-bucket` → scope: `bucket` or `constructs`
- `app/functions/` → scope: `lambda` or `functions`
- Cross-cutting → scope: `infra`, `deps`, or the affected domain

## Action Types

Use only types that apply. Most CDK commits need 1-3 action lines.

### `intent(scope): ...`
What infrastructure goal the user wanted to achieve.

### `decision(scope): ...`
What approach was chosen when alternatives existed.

### `rejected(scope): ...`
What was considered and discarded. Always include the reason.

### `constraint(scope): ...`
Hard limits that shaped the design.

### `learned(scope): ...`
Discoveries that save time in future sessions.

### `impact(scope): ...`
Blast radius and dependency effects of the change.

## Version Tagging (MAJOR.MINOR.PATCH)

### MAJOR — Breaking changes
- Adding or removing an environment in `project_configs/environment_options.yaml`
- Changes to `bin/` app entry point that alter stack instantiation pattern
- Changes to `project_configs/config-loader.ts` interface
- cdk-nag pack changes (e.g., switching from AwsSolutions to HIPAA)
- CDK major version upgrades requiring construct migration

### MINOR — Capability changes
- Adding a new stack in `lib/stacks/`
- Adding a new construct in `lib/constructs/`
- Adding new Lambda functions in `app/functions/`
- Adding new resources to existing stacks
- New stack props or outputs

### PATCH — Fixes and settings
- Bug fixes in construct configurations
- cdk-nag suppression additions with justification
- Environment-specific config value changes
- Documentation updates
- Dependency patch/minor bumps
- Test additions or fixes
- Tag updates

## Rules

1. Subject line is a Conventional Commit.
2. Action lines go in the body only.
3. Only write action lines that carry signal.
4. Use consistent scopes matching stack/construct names.
5. Capture the user's intent in their words.
6. Always explain why for `rejected` lines.
7. Don't fabricate context you don't have.
8. Assess blast radius for every commit.
9. Version tags require a clean commit history.
10. Never skip version assessment.

## Reference Files

- `references/versioning-guide.md` — Version decision matrix with CDK examples
- `references/commit-examples.md` — CDK-specific commit message examples
