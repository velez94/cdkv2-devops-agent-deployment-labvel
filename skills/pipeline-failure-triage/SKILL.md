---
name: pipeline-failure-triage
description: Triage procedures for Azure DevOps pipeline failures across
  Bank4Us and Kora products. Use this skill when build or deployment
  pipelines fail, including compilation errors, test failures, infrastructure
  provisioning failures, and artifact publishing issues.
---

# Pipeline Failure Triage

Use this skill when a CI/CD pipeline in Azure DevOps fails and triggers
an incident or requires investigation.

## Step 1: Get pipeline run details

Use the MCP server tool `get_pipeline_status` to retrieve the failed
pipeline run details including:
- Which stage failed (build, test, deploy, post-deploy)
- Error message from the failed step
- Duration and timing

## Step 2: Get build logs

Use `get_azure_devops_build_log` to retrieve the error output.
Focus on the last 50 lines of the failed step.

## Step 3: Classify the failure

| Pattern | Classification | Action |
|---------|---------------|--------|
| Compilation error | Code issue | Route to developer |
| Test failure | Regression | Identify failing test + recent change |
| CDK synth failure | IaC issue | Check cdk-nag violations |
| Deployment timeout | Infrastructure | Check target account health |
| Permission denied | IAM issue | Verify cross-account roles |

## Step 4: Correlate with recent changes

Check git commits in the past 24h that touched the failing module.
Identify the most likely change that introduced the failure.

## Step 5: Provide resolution path

1. Link to the specific commit/PR that likely caused the failure
2. Suggest fix (revert, config change, permission update)
3. If infrastructure: provide CDK template modification
