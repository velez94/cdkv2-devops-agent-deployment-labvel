---
name: ecs-deployment-investigation
description: Investigation procedures for ECS deployment failures including
  task health check failures, container startup crashes, image pull errors,
  and service stability issues. Use this skill when investigating ECS service
  alarms, deployment rollbacks, or task count mismatches across Bank4Us and
  Kora product environments.
---

# ECS Deployment Investigation

Use this skill when ECS services report deployment failures, task health
check failures, or desired vs running task count mismatches.

## Step 1: Identify the affected service

Query CloudWatch for ECS service alarms in ALARM state. Correlate with
recent deployments by checking the service's deployment history via
the operations account CloudWatch metrics.

## Step 2: Check deployment status

Retrieve the ECS service events for the past hour. Look for:
- "has reached a steady state" → deployment succeeded
- "failed to launch task" → container or image issue
- "rolling back" → health check failures

## Step 3: Analyze task failures

For failed tasks, check:
- Exit code (137 = OOM killed, 1 = application error)
- Container logs in CloudWatch Logs
- Image pull status (ECR permissions, image exists)

## Step 4: Correlate with code changes

Query Azure DevOps (via MCP server) for recent pipeline runs that
deployed to this service. Compare the deployed image tag with the
previously stable version.

## Step 5: Recommend remediation

Provide:
1. Root cause (code regression, config change, resource limit)
2. Immediate action (rollback to previous task definition)
3. Fix forward (specific code/config change needed)
