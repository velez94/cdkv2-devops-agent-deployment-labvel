#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AwsSolutionsChecks } from 'cdk-nag';
import { AgentAccessRoleStack } from '../lib/stacks/agent/agent-access-role-stack';
import { DevOpsAgentStack, DevOpsAgentConfig, MonitoredAccountConfig } from '../lib/stacks/agent/devops-agent-stack';
import { PipelineStack } from '../lib/stacks/pipeline/pipeline-stack';
import { loadConfig, AgentSpaceYamlConfig } from '../project_configs/config-loader';

const app = new cdk.App();
const config = loadConfig();

const environment = app.node.tryGetContext('env') || process.env.ENV || 'dev';

if (config.pipeline.mode === 'cdk-pipelines') {
  // ─── CDK Pipelines Mode (Hub Model) ──────────────────────────────────
  //
  // Architecture:
  //   Pipeline Account (devsecops):
  //     ├── CodePipeline (self-mutating)
  //     ├── Agent Space "NonProd" → monitors dev + qa
  //     └── Agent Space "Prod"    → monitors prd
  //
  //   Target Accounts (deployed via pipeline stages):
  //     └── AgentAccessRoleStack (IAM role only)
  //
  // First-time setup:
  //   1. Create CodeConnections connection (Console → Developer Tools → Connections)
  //   2. Bootstrap target accounts with --trust to pipeline account
  //   3. cdk deploy *-Pipeline --profile <devsecops-profile>
  //
  new PipelineStack(app, `${config.project_name}-Pipeline`, {
    env: {
      account: config.pipeline.pipeline_account,
      region: config.pipeline.pipeline_region,
    },
    tags: { ...config.tags, Environment: 'pipeline' },
    projectName: config.project_name,
    pipelineConfig: config.pipeline.cdk_pipelines!,
    deployOrder: config.pipeline.deploy_order || [],
    environments: config.environments,
    agentSpaces: config.agent_spaces,
    mcpServers: config.mcp_servers,
    privateConnection: config.private_connection,
    useIdentityCenter: config.use_identity_center,
    identityCenterInstanceArn: config.identity_center_instance_arn,
  });
} else {
  // ─── Direct Deploy Mode (GitHub Actions / Azure DevOps / manual) ──────
  //
  // In direct mode, you deploy stacks individually.
  // Use --context target=agent-space to deploy Agent Spaces in the hub account.
  // Use --context target=access-role to deploy IAM roles in target accounts.
  //
  const target = app.node.tryGetContext('target') || 'access-role';
  const pipelineAccountId = config.pipeline.pipeline_account || '';

  if (target === 'agent-space') {
    // ─── Deploy Agent Spaces in the hub (pipeline/devsecops) account ────
    if (!config.agent_spaces) {
      throw new Error('No agent_spaces defined in config. Nothing to deploy.');
    }

    for (const spaceConfig of config.agent_spaces) {
      const agentConfig = buildAgentConfigFromSpace(spaceConfig, pipelineAccountId);

      new DevOpsAgentStack(app, `${config.project_name}-AgentSpace-${spaceConfig.tier}`, {
        env: {
          account: pipelineAccountId,
          region: config.pipeline.pipeline_region || 'us-east-1',
        },
        tags: { ...config.tags, Environment: spaceConfig.tier, AgentSpace: spaceConfig.name },
        projectName: config.project_name,
        environment: spaceConfig.tier,
        agentConfig,
      });
    }
  } else {
    // ─── Deploy AgentAccessRole in target account ───────────────────────
    const envConfig = config.environments[environment];

    if (!envConfig) {
      throw new Error(
        `Unknown environment: ${environment}. Available: ${Object.keys(config.environments).join(', ')}`,
      );
    }

    // Find which space monitors this environment
    const spaceConfig = config.agent_spaces?.find((s) =>
      s.monitored_accounts.some((ma) => ma.environment === environment),
    );

    if (!spaceConfig) {
      throw new Error(
        `No agent_space monitors environment "${environment}". Check agent_spaces config.`,
      );
    }

    new AgentAccessRoleStack(app, `${config.project_name}-AgentAccessRole-${environment}`, {
      env: { account: envConfig.account, region: envConfig.region },
      tags: { ...config.tags, Environment: environment },
      projectName: config.project_name,
      environment,
      agentSpaceAccountId: pipelineAccountId,
      agentSpaceName: spaceConfig.name,
    });
  }
}

/**
 * Build DevOpsAgentConfig from an AgentSpaceYamlConfig.
 */
function buildAgentConfigFromSpace(
  spaceConfig: AgentSpaceYamlConfig,
  hubAccountId: string,
): DevOpsAgentConfig {
  const monitoredAccounts: MonitoredAccountConfig[] = spaceConfig.monitored_accounts.map(
    (ma) => ({
      accountId: ma.account_id,
      roleArn: `arn:aws:iam::${ma.account_id}:role/DevOpsAgentAccessRole-${spaceConfig.name}`,
      regions: ma.regions,
    }),
  );

  return {
    spaceName: spaceConfig.name,
    spaceDescription: spaceConfig.description,
    monitoredAccounts,
    mcpServers: config.mcp_servers?.map((m) => ({
      serviceType: m.service_type,
      name: m.name,
      targetUrl: m.target_url,
      privateConnectionName: m.private_connection_name,
    })),
    privateConnection: config.private_connection
      ? {
          name: config.private_connection.name,
          hostAddress: config.private_connection.host_address,
          vpcId: config.private_connection.vpc_id,
          subnetIds: config.private_connection.subnet_ids,
          securityGroupIds: config.private_connection.security_group_ids,
        }
      : undefined,
    useIdentityCenter: config.use_identity_center,
    identityCenterInstanceArn: config.identity_center_instance_arn,
  };
}

// cdk-nag v3: instantiate with scope directly (no Aspects.of().add())
new AwsSolutionsChecks(app, { verbose: true });
