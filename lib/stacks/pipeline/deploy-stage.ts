import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { AgentAccessRoleStack } from '../agent/agent-access-role-stack';

export interface DeployStageProps extends cdk.StageProps {
  projectName: string;
  environment: string;
  /** The hub account where Agent Spaces are deployed */
  agentSpaceAccountId: string;
  /** Agent Space name that monitors this environment */
  agentSpaceName: string;
}

/**
 * CDK Pipelines Stage for target (workload) accounts.
 *
 * In the hub model, target accounts only receive the IAM role
 * that the Agent Space (in the devsecops account) assumes to investigate.
 *
 * The Agent Space itself is deployed directly in the pipeline account,
 * NOT inside this stage.
 *
 * Deployment:
 *   AgentAccessRoleStack (IAM role for cross-account agent investigation)
 */
export class DeployStage extends cdk.Stage {
  constructor(scope: Construct, id: string, props: DeployStageProps) {
    super(scope, id, props);

    // Agent Access Role: allows the DevOps Agent to investigate this account
    new AgentAccessRoleStack(this, 'AgentAccessRole', {
      projectName: props.projectName,
      environment: props.environment,
      agentSpaceAccountId: props.agentSpaceAccountId,
      agentSpaceName: props.agentSpaceName,
    });
  }
}
