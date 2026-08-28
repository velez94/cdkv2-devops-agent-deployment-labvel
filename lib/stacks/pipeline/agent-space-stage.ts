import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { DevOpsAgentStack, DevOpsAgentConfig } from '../agent/devops-agent-stack';

export interface AgentSpaceStageProps extends cdk.StageProps {
  projectName: string;
  /** Agent Space configuration for this tier */
  agentConfig: DevOpsAgentConfig;
  /** Tier name (nonprod/prod) used for stack naming */
  tier: string;
}

/**
 * CDK Pipelines Stage for deploying Agent Spaces in the pipeline (hub) account.
 *
 * This stage is added to the pipeline to deploy the Agent Space resources
 * (KMS key, IAM roles, Agent Space, Associations) in the same account
 * where the pipeline runs.
 */
export class AgentSpaceStage extends cdk.Stage {
  constructor(scope: Construct, id: string, props: AgentSpaceStageProps) {
    super(scope, id, props);

    new DevOpsAgentStack(this, 'AgentSpace', {
      projectName: props.projectName,
      environment: props.tier,
      agentConfig: props.agentConfig,
    });
  }
}
