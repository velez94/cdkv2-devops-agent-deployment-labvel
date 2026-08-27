#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AwsSolutionsChecks } from 'cdk-nag';
import { FoundationStack } from '../lib/stacks/foundation/foundation-stack';
import { DevOpsAgentStack, DevOpsAgentConfig } from '../lib/stacks/agent/devops-agent-stack';
import { PipelineStack } from '../lib/stacks/pipeline/pipeline-stack';
import { loadConfig } from '../project_configs/config-loader';

const app = new cdk.App();
const config = loadConfig();

const environment = app.node.tryGetContext('env') || process.env.ENV || 'dev';

/**
 * Build DevOpsAgentConfig from YAML config (shared between both modes).
 */
function buildAgentConfig(yamlConfig: typeof config.devops_agent): DevOpsAgentConfig | undefined {
  if (!yamlConfig) return undefined;
  return {
    spaceName: yamlConfig.space_name,
    spaceDescription: yamlConfig.space_description,
    monitoredAccounts: yamlConfig.monitored_accounts?.map((a) => ({
      accountId: a.account_id,
      roleArn: a.role_arn,
      regions: a.regions,
    })),
    mcpServers: yamlConfig.mcp_servers?.map((m) => ({
      serviceType: m.service_type,
      name: m.name,
      targetUrl: m.target_url,
      privateConnectionName: m.private_connection_name,
    })),
    privateConnection: yamlConfig.private_connection
      ? {
          name: yamlConfig.private_connection.name,
          hostAddress: yamlConfig.private_connection.host_address,
          vpcId: yamlConfig.private_connection.vpc_id,
          subnetIds: yamlConfig.private_connection.subnet_ids,
          securityGroupIds: yamlConfig.private_connection.security_group_ids,
        }
      : undefined,
    useIdentityCenter: yamlConfig.use_identity_center,
    identityCenterInstanceArn: yamlConfig.identity_center_instance_arn,
  };
}

if (config.pipeline.mode === 'cdk-pipelines') {
  // ─── CDK Pipelines Mode ───────────────────────────────────────────────
  // Deploys a self-mutating CodePipeline that manages all environments.
  // The pipeline itself lives in the pipeline account.
  // Workload stacks are deployed by the pipeline via DeployStage.
  //
  // First-time setup:
  //   1. Create CodeConnections connection (Console → Developer Tools → Connections)
  //   2. Bootstrap target accounts with --trust to pipeline account
  //   3. cdk deploy *-Pipeline --context env=dev
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
    devopsAgentConfig: config.devops_agent,
  });
} else {
  // ─── Direct Deploy Mode (GitHub Actions / Azure DevOps / manual) ──────
  // Stacks are deployed directly by the CI runner or developer via `cdk deploy`.
  // The CI/CD tool handles environment promotion and approvals externally.
  //
  const envConfig = config.environments[environment];

  if (!envConfig) {
    throw new Error(
      `Unknown environment: ${environment}. Available: ${Object.keys(config.environments).join(', ')}`,
    );
  }

  const stackProps: cdk.StackProps = {
    env: { account: envConfig.account, region: envConfig.region },
    tags: { ...config.tags, Environment: environment },
  };

  // Foundation layer
  new FoundationStack(app, `${config.project_name}-Foundation-${environment}`, {
    ...stackProps,
    projectName: config.project_name,
    environment,
  });

  // Agent layer (only if devops_agent config is present)
  const agentConfig = buildAgentConfig(config.devops_agent);
  if (agentConfig) {
    new DevOpsAgentStack(app, `${config.project_name}-Agent-${environment}`, {
      ...stackProps,
      projectName: config.project_name,
      environment,
      agentConfig,
    });
  }
}

// cdk-nag v3: instantiate with scope directly (no Aspects.of().add())
new AwsSolutionsChecks(app, { verbose: true });
