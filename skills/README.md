# DevOps Agent Skills

This directory contains [AWS DevOps Agent Skills](https://docs.aws.amazon.com/devopsagent/latest/userguide/about-aws-devops-agent-devops-agent-skills.html) — modular instruction sets that extend the agent with specialized investigation procedures for this project's infrastructure.

## Structure

```
skills/
├── ecs-deployment-investigation/    # Incident RCA for ECS failures
│   ├── SKILL.md
│   └── references/
├── pipeline-failure-triage/         # Incident Triage for CI/CD failures
│   ├── SKILL.md
│   └── references/
├── daily-health-report/             # On-demand (scheduled SRE agent)
│   ├── SKILL.md
│   └── references/
└── skip-scheduled-maintenance/      # Incident Triage (auto-skip filter)
    └── SKILL.md
```

## How to Import into Agent Space

### Option 1: Import from GitHub (recommended)

1. Push this repo to GitHub
2. In Agent Space → Knowledge → Skills → **Add skill** → **Import from repository**
3. Paste the directory URL:
   ```
   https://github.com/<org>/<repo>/tree/main/skills/ecs-deployment-investigation
   ```
4. Select the agent type and import
5. Repeat for each skill

Skills auto-sync when you push updates to the repo.

### Option 2: Upload as ZIP

```bash
cd skills/ecs-deployment-investigation
zip -r ecs-deployment-investigation.zip .
# Upload via Agent Space → Knowledge → Skills → Add skill → Upload skill
```

### Option 3: Create in UI

Copy the content of `SKILL.md` into the Agent Space UI (name, description, instructions).

## Agent Type Targeting

| Skill | Recommended Agent Type |
|-------|----------------------|
| `ecs-deployment-investigation` | Incident RCA |
| `pipeline-failure-triage` | Incident Triage |
| `daily-health-report` | On-demand |
| `skip-scheduled-maintenance` | Incident Triage |

## Adding a New Skill

1. Create a new directory: `skills/<skill-name>/`
2. Add `SKILL.md` with required frontmatter:
   ```markdown
   ---
   name: my-new-skill
   description: Detailed description of when the agent should use this skill.
     Include specific scenarios, services, error types, or symptoms that
     should trigger it. Minimum 100 characters recommended.
   ---

   # My New Skill

   ## Step 1: ...
   ```
3. Optionally add `references/` and `assets/` directories
4. Import into Agent Space via GitHub URL

## Constraints

- `name`: lowercase, numbers, hyphens only (max 64 chars)
- `description`: min 100 chars recommended, max 1024 chars
- ZIP upload: max 6 MB total
- No executable scripts (until Sandbox GA)
