import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { FoundationStack } from '../foundation/foundation-stack';
import { DevOpsAgentStack, DevOpsAgentConfig } from '../agent/devops-agent-stack';

export interface DeployStageProps extends cdk.StageProps {
  projectName: string;
  environment: string;
  /** DevOps Agent config (optional — if undefined, only Foundation is deployed) */
  agentConfig?: DevOpsAgentConfig;
}

/**
 * CDK Pipelines Stage wrapping all workload stacks for a single environment.
 *
 * Deployment order:
 *   Foundation → DevOpsAgent (if configured)
 */
export class DeployStage extends cdk.Stage {
  constructor(scope: Construct, id: string, props: DeployStageProps) {
    super(scope, id, props);

    const sharedProps = {
      projectName: props.projectName,
      environment: props.environment,
    };

    // Foundation layer (always deployed)
    const foundation = new FoundationStack(this, 'Foundation', sharedProps);

    // Agent layer (deployed when devops_agent config is present)
    if (props.agentConfig) {
      const agent = new DevOpsAgentStack(this, 'Agent', {
        ...sharedProps,
        agentConfig: props.agentConfig,
      });
      agent.addStackDependency(foundation);
    }
  }
}
