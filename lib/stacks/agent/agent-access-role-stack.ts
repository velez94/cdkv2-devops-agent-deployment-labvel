import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface AgentAccessRoleStackProps extends cdk.StackProps {
  /** Project name for naming and tagging */
  projectName: string;
  /** Environment name (dev/qa/prd) */
  environment: string;
  /** The Agent Space account (hub) that will assume this role */
  agentSpaceAccountId: string;
  /** Agent Space name for naming clarity */
  agentSpaceName: string;
}

/**
 * Lightweight stack deployed to target accounts.
 *
 * Creates only the IAM role that the DevOps Agent (running in the hub account)
 * assumes to investigate this account's resources.
 *
 * This role:
 * - Is assumed by the aidevops.amazonaws.com service principal
 * - Uses the AIDevOpsAgentAccessPolicy managed policy (read-only investigation)
 * - Allows creation of Resource Explorer service-linked role
 * - Trusts only the hub (devsecops) account via SourceAccount condition
 *
 * Aligns with: https://docs.aws.amazon.com/devopsagent/latest/userguide/
 * getting-started-with-aws-devops-agent-getting-started-with-aws-devops-agent-using-aws-cdk.html
 * (Part 2: cross-account monitoring)
 */
export class AgentAccessRoleStack extends cdk.Stack {
  public readonly agentAccessRole: iam.Role;
  public readonly roleArn: string;

  constructor(scope: Construct, id: string, props: AgentAccessRoleStackProps) {
    super(scope, id, props);

    const account = cdk.Stack.of(this).account;
    const region = cdk.Stack.of(this).region;

    // Agent Space ARN pattern this role trusts. Using a wildcard on the
    // agentspace segment avoids a hard dependency on the Agent Space being
    // created first (the ARN is not known at role-creation time).
    const agentSpaceArnPattern = `arn:aws:aidevops:${region}:${props.agentSpaceAccountId}:agentspace/*`;

    // IAM Role: assumed by DevOps Agent service from the hub account
    this.agentAccessRole = new iam.Role(this, 'AgentAccessRole', {
      roleName: `DevOpsAgentAccessRole-${props.agentSpaceName}`,
      assumedBy: new iam.ServicePrincipal('aidevops.amazonaws.com', {
        conditions: {
          StringEquals: {
            'aws:SourceAccount': props.agentSpaceAccountId,
          },
          ArnLike: {
            'aws:SourceArn': agentSpaceArnPattern,
          },
        },
      }),
      description: `Cross-account role for DevOps Agent Space "${props.agentSpaceName}" to investigate ${props.environment} resources`,
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AIDevOpsAgentAccessPolicy'),
      ],
    });

    // Inline policy: Allow creation of Resource Explorer service-linked role
    this.agentAccessRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'AllowResourceExplorerSLR',
        effect: iam.Effect.ALLOW,
        actions: ['iam:CreateServiceLinkedRole'],
        resources: [
          `arn:aws:iam::${account}:role/aws-service-role/resource-explorer-2.amazonaws.com/*`,
        ],
        conditions: {
          StringEquals: {
            'iam:AWSServiceName': 'resource-explorer-2.amazonaws.com',
          },
        },
      }),
    );

    this.roleArn = this.agentAccessRole.roleArn;

    // Outputs
    new cdk.CfnOutput(this, 'AgentAccessRoleArn', {
      value: this.agentAccessRole.roleArn,
      description: `Agent Access Role ARN for ${props.environment}`,
      exportName: `${props.projectName}-${props.environment}-AgentAccessRoleArn`,
    });
  }
}
