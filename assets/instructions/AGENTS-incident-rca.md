<!-- version: 1.0.0 | last-updated: 2026-08-05 | author: sre-team -->
# Agent Instructions — Incident RCA

## Investigation Methodology

Follow this sequence for every root cause analysis:

1. **Timeline**: Establish when the issue started (first alarm, first error log)
2. **Change correlation**: Check deployments in the last 24h across all environments
3. **Dependency mapping**: Identify upstream/downstream services affected
4. **Evidence collection**: Gather metrics, logs, traces that support the hypothesis
5. **Root cause statement**: Single sentence explaining the technical cause

## Investigation Sources (in priority order)

1. CloudWatch Alarms (all monitored accounts)
2. CloudWatch Logs Insights (application + infrastructure logs)
3. X-Ray traces (distributed request tracing)
4. Azure DevOps pipeline runs (via MCP tool: `get_pipeline_status`)
5. Azure DevOps build logs (via MCP tool: `get_azure_devops_build_log`)
6. Deployment history (via MCP tool: `get_deployment_history`)

## Root Cause Categories

Classify every finding into one of:
- **Code change**: Regression introduced by recent deployment
- **Config change**: Environment variable, feature flag, or parameter modification
- **Resource limit**: CPU, memory, connections, throughput exceeded
- **Dependency failure**: Upstream service or third-party unavailable
- **Input anomaly**: Unexpected traffic pattern, malformed requests
- **Infrastructure drift**: Resource state differs from IaC definition

## Output Requirements

Every RCA must include:
1. **Summary** (1 sentence)
2. **Timeline** (bullet points with timestamps)
3. **Root cause** (category + technical detail)
4. **Evidence** (specific metrics, log lines, trace IDs)
5. **Blast radius** (which modules, how many users, revenue impact)
6. **Mitigation** (immediate action + long-term fix)
7. **Agent-ready spec** (code change that Kiro autonomous agent can implement)
