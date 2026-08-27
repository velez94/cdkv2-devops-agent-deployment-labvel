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
  DevOpsAgentYamlConfig,
} from '../../../project_configs/config-loader';
import { DeployStage } from './deploy-stage';
import { DevOpsAgentConfig } from '../agent/devops-agent-stack';

export interface PipelineStackProps extends cdk.StackProps {
  projectName: string;
  pipelineConfig: CdkPipelinesConfig;
  deployOrder: DeployStageConfig[];
  environments: Record<string, EnvironmentConfig>;
  /** DevOps Agent YAML config — passed to each stage */
  devopsAgentConfig?: DevOpsAgentYamlConfig;
}

/**
 * Self-mutating CDK Pipeline using AWS CodePipeline.
 *
 * Prerequisites:
 * 1. AWS CodeConnections connection in AVAILABLE status
 *    (Console → Developer Tools → Settings → Connections → Create connection)
 *    The connection requires a one-time OAuth handshake with your VCS provider.
 *
 * 2. CDK bootstrap in all target accounts with trust to the pipeline account:
 *    cdk bootstrap aws://TARGET_ACCOUNT/REGION \
 *      --trust PIPELINE_ACCOUNT \
 *      --cloudformation-execution-policies arn:aws:iam::aws:policy/AdministratorAccess
 *
 * 3. First deploy is manual:
 *    cdk deploy *-Pipeline --context env=dev
 *
 * After that, the pipeline self-mutates and deploys all stages on every git push.
 */
export class PipelineStack extends cdk.Stack {
  public readonly pipeline: CodePipeline;

  constructor(scope: Construct, id: string, props: PipelineStackProps) {
    super(scope, id, props);

    // Source: VCS connection (GitHub, Bitbucket, GitLab via AWS CodeConnections)
    const source = CodePipelineSource.connection(
      props.pipelineConfig.repo,
      props.pipelineConfig.branch,
      {
        connectionArn: props.pipelineConfig.connection_arn,
        // triggerOnPush defaults to true — pipeline runs on every push to branch
      },
    );

    // Synth step: install, build, test, and synthesize
    const synthStep = new ShellStep('Synth', {
      input: source,
      installCommands: ['npm ci'],
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

    // Build agent config for stages (if devops_agent section exists)
    const agentConfig = this.buildAgentConfig(props.devopsAgentConfig);

    // Add deployment stages in order
    for (const stageConfig of props.deployOrder) {
      const envConfig = props.environments[stageConfig.environment];

      if (!envConfig) {
        throw new Error(
          `deploy_order references environment "${stageConfig.environment}" ` +
            `but it is not defined in environments config.`,
        );
      }

      const stage = new DeployStage(this, `Deploy-${stageConfig.environment}`, {
        env: { account: envConfig.account, region: envConfig.region },
        projectName: props.projectName,
        environment: stageConfig.environment,
        agentConfig,
      });

      // Add stage with optional manual approval gate
      if (stageConfig.manual_approval) {
        this.pipeline.addStage(stage, {
          pre: [
            new ManualApprovalStep(`Approve-${stageConfig.environment}`, {
              comment: `Approve deployment to ${stageConfig.environment.toUpperCase()}`,
            }),
          ],
        });
      } else {
        this.pipeline.addStage(stage);
      }
    }
  }

  /**
   * Convert YAML-shaped config to the DevOpsAgentConfig interface expected by the stack.
   */
  private buildAgentConfig(yamlConfig?: DevOpsAgentYamlConfig): DevOpsAgentConfig | undefined {
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
}
