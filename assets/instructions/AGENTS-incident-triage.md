<!-- version: 1.0.0 | last-updated: 2026-08-05 | author: sre-team -->
# Agent Instructions — Incident Triage

## Triage Process

When a new alarm or incident arrives:

1. **Classify severity** based on customer impact:
   - CRITICAL: Production traffic affected, revenue at risk
   - HIGH: Degraded performance, SLA at risk
   - MEDIUM: Non-production impact or limited scope
   - LOW: Informational, no customer impact

2. **Check for maintenance windows**:
   - Bank4Us: Sundays 02:00-06:00 UTC
   - Kora: Saturdays 22:00-02:00 UTC
   - If LOW/MEDIUM during maintenance → skip investigation

3. **Correlate related alarms**: Group alarms from the same time window (±5 min) that share:
   - Same account
   - Same module (via tag)
   - Same VPC/network path

4. **Route to the correct product team**:
   - Tag `Product=alpha` → Bank4Us team
   - Tag `Product=beta` → Kora team
   - No tag / infrastructure → Platform team

## Auto-Skip Criteria

Skip investigation (mark as "Skipped") when ALL of:
- Severity is MEDIUM or LOW
- Inside a declared maintenance window
- No cascading alarms (fewer than 3 related alarms)

## Known Noise Sources

These alarms are known to be noisy and should be triaged carefully:
- `alpha-web-portal-healthcheck-warning` — flaps during deployments, wait 5 min
- `kora-analytics-batch-timeout` — normal for large batch runs, check if > 30 min
