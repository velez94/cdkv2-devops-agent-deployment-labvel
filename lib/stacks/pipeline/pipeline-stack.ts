import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {
  CodePipeline,
  CodePipelineSource,
  ShellStep,
  ManualApprovalStep,
} from 'aws-cdk-lib/pipelines';
import {
  CdkPipelinesConfig,
  DeployStage as DeployStageConfig,
  EnvironmentConfig,
  AgentSpaceYamlConfig,
  McpServerYamlConfig,
  PrivateConnectionYamlConfig,
} from '../../../project_configs/config-loader';
import { DeployStage } from './deploy-stage';
import { AgentSpaceStage } from './agent-space-stage';
import { DevOpsAgentConfig, MonitoredAccountConfig } from '../agent/devops-agent-stack';

export interface PipelineStackProps extends cdk.StackProps {
  projectName: string;
  pipelineConfig: CdkPipelinesConfig;
  deployOrder: DeployStageConfig[];
  environments: Record<string, EnvironmentConfig>;
  /** Hub model: Agent Spaces deployed in this (pipeline) account */
  agentSpaces?: AgentSpaceYamlConfig[];
  /** Shared MCP server config */
  mcpServers?: McpServerYamlConfig[];
  /** Shared private connection config */
  privateConnection?: PrivateConnectionYamlConfig;
  /** Identity Center settings */
  useIdentityCenter?: boolean;
  identityCenterInstanceArn?: string;
}

/**
 * Self-mutating CDK Pipeline using AWS CodePipeline.
 *
 * Architecture (Hub Model):
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ Pipeline Account (devsecops)                                    │
 * │  ├── CodePipeline (self-mutating)                               │
 * │  ├── Agent Space "NonProd" → monitors dev + qa accounts         │
 * │  └── Agent Space "Prod"   → monitors prd account               │
 * └─────────────────────────────────────────────────────────────────┘
 *         │ deploys cross-account
 *         ▼
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ Target Accounts (dev, qa, prd)                                  │
 * │  └── AgentAccessRoleStack (IAM role only)                       │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * Prerequisites:
 * 1. AWS CodeConnections connection in AVAILABLE status
 * 2. CDK bootstrap in all target accounts with --trust to pipeline account
 * 3. First deploy: cdk deploy *-Pipeline --profile <devsecops-profile>
 */
export class PipelineStack extends cdk.Stack {
  public readonly pipeline: CodePipeline;

  constructor(scope: Construct, id: string, props: PipelineStackProps) {
    super(scope, id, props);

    const pipelineAccountId = this.account;

    // Source: VCS connection (GitHub, Bitbucket, GitLab via AWS CodeConnections)
    const source = CodePipelineSource.connection(
      props.pipelineConfig.repo,
      props.pipelineConfig.branch,
      {
        connectionArn: props.pipelineConfig.connection_arn,
      },
    );

    // Synth step: install, build, test, and synthesize
    const synthStep = new ShellStep('Synth', {
      input: source,
      installCommands: [
        // aws-cdk-lib >= 2.263.0 requires Node >= 20
        'n 20',
        'npm ci',
      ],
      commands: ['npm run build', 'npm test', 'npx cdk synth'],
    });

    // Create the self-mutating pipeline
    this.pipeline = new CodePipeline(this, 'Pipeline', {
      pipelineName: `${props.projectName}-pipeline`,
      selfMutation: props.pipelineConfig.self_mutating,
      synth: synthStep,
      // Cross-account deployments require this
      crossAccountKeys: true,
    });

    // ─── Interleaved deployment per Agent Space tier ───────────────────
    // For each Agent Space, deploy the cross-account IAM roles for the
    // accounts it monitors FIRST, then deploy the Agent Space itself.
    // This ordering lets each tier (e.g. nonprod) complete independently
    // without waiting behind a later tier's manual approval gate (e.g. prod).
    //
    // Result stage order example:
    //   Deploy-dev → Deploy-qa → AgentSpace-nonprod
    //   → [Approve-prd] Deploy-prd → AgentSpace-prod

    // Map environment → manual_approval flag from deploy_order
    const approvalByEnv = new Map<string, boolean>();
    for (const stageConfig of props.deployOrder) {
      const envConfig = props.environments[stageConfig.environment];
      if (!envConfig) {
        throw new Error(
          `deploy_order references environment "${stageConfig.environment}" ` +
            `but it is not defined in environments config.`,
        );
      }
      approvalByEnv.set(stageConfig.environment, stageConfig.manual_approval);
    }

    if (props.agentSpaces) {
      for (const spaceConfig of props.agentSpaces) {
        // 1. Deploy the cross-account role to each monitored account for this space
        for (const monitored of spaceConfig.monitored_accounts) {
          const envConfig = props.environments[monitored.environment];
          if (!envConfig) {
            throw new Error(
              `Agent space "${spaceConfig.name}" references environment ` +
                `"${monitored.environment}" not defined in environments config.`,
            );
          }

          const roleStage = new DeployStage(this, `Deploy-${monitored.environment}`, {
            env: { account: envConfig.account, region: envConfig.region },
            projectName: props.projectName,
            environment: monitored.environment,
            agentSpaceAccountId: pipelineAccountId,
            agentSpaceName: spaceConfig.name,
          });

          const requiresApproval = approvalByEnv.get(monitored.environment) ?? false;
          if (requiresApproval) {
            this.pipeline.addStage(roleStage, {
              pre: [
                new ManualApprovalStep(`Approve-${monitored.environment}`, {
                  comment: `Approve deployment to ${monitored.environment.toUpperCase()}`,
                }),
              ],
            });
          } else {
            this.pipeline.addStage(roleStage);
          }
        }

        // 2. Deploy the Agent Space (creates associations to the roles above)
        const agentConfig = this.buildAgentConfig(
          spaceConfig,
          props.environments,
          pipelineAccountId,
          props.mcpServers,
          props.privateConnection,
          props.useIdentityCenter,
          props.identityCenterInstanceArn,
        );

        const agentStage = new AgentSpaceStage(this, `AgentSpace-${spaceConfig.tier}`, {
          env: { account: pipelineAccountId, region: this.region },
          projectName: props.projectName,
          agentConfig,
          tier: spaceConfig.tier,
        });

        this.pipeline.addStage(agentStage);
      }
    }
  }

  /**
   * Convert YAML-shaped AgentSpaceConfig to the DevOpsAgentConfig interface.
   */
  private buildAgentConfig(
    spaceConfig: AgentSpaceYamlConfig,
    environments: Record<string, EnvironmentConfig>,
    hubAccountId: string,
    mcpServers?: McpServerYamlConfig[],
    privateConnection?: PrivateConnectionYamlConfig,
    useIdentityCenter?: boolean,
    identityCenterInstanceArn?: string,
  ): DevOpsAgentConfig {
    // Build monitored accounts with role ARN derived from the AgentAccessRoleStack
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
      mcpServers: mcpServers?.map((m) => ({
        serviceType: m.service_type,
        name: m.name,
        targetUrl: m.target_url,
        privateConnectionName: m.private_connection_name,
      })),
      privateConnection: privateConnection
        ? {
            name: privateConnection.name,
            hostAddress: privateConnection.host_address,
            vpcId: privateConnection.vpc_id,
            subnetIds: privateConnection.subnet_ids,
            securityGroupIds: privateConnection.security_group_ids,
          }
        : undefined,
      useIdentityCenter,
      identityCenterInstanceArn,
    };
  }
}
