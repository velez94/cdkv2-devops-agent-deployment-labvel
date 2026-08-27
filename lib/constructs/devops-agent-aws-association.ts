import * as devopsagent from 'aws-cdk-lib/aws-devopsagent';
import { Construct } from 'constructs';

export interface DevOpsAgentAwsAssociationProps {
  /** Agent Space ID to associate with */
  agentSpaceId: string;
  /** AWS account ID to monitor */
  accountId: string;
  /** IAM role ARN the agent assumes in the target account */
  roleArn: string;
  /** Regions to monitor (optional, defaults to all) */
  regions?: string[];
}

/**
 * L2-like construct wrapping AWS::DevOpsAgent::Association for AWS accounts.
 *
 * Associates an AWS account with an Agent Space, enabling DevOps Agent
 * to access CloudWatch, CloudTrail, X-Ray, and other observability data
 * from the target account.
 *
 * Uses association type "Aws" with accountType "monitor".
 */
export class DevOpsAgentAwsAssociation extends Construct {
  public readonly associationId: string;

  constructor(scope: Construct, id: string, props: DevOpsAgentAwsAssociationProps) {
    super(scope, id);

    const association = new devopsagent.CfnAssociation(this, 'Resource', {
      agentSpaceId: props.agentSpaceId,
      serviceId: 'aws',
      configuration: {
        aws: {
          accountId: props.accountId,
          accountType: 'monitor',
          assumableRoleArn: props.roleArn,
        },
      },
    });

    this.associationId = association.attrAssociationId;
  }
}

export interface DevOpsAgentSourceAwsAssociationProps {
  /** Agent Space ID to associate with */
  agentSpaceId: string;
  /** The hosting (source) account ID where the Agent Space lives */
  accountId: string;
  /** IAM role ARN the agent assumes in the source account */
  roleArn: string;
}

/**
 * L2-like construct wrapping AWS::DevOpsAgent::Association for the SOURCE account.
 *
 * The SourceAws association represents the hosting account itself — the account
 * where the Agent Space is deployed. This is created alongside the Agent Space
 * and enables the agent to monitor the hosting account's own resources.
 *
 * This is different from the "Aws" (monitor) association which is for remote accounts.
 *
 * Ref: https://docs.aws.amazon.com/devopsagent/latest/userguide/
 * getting-started-with-aws-devops-agent-getting-started-with-aws-devops-agent-using-aws-cdk.html
 */
export class DevOpsAgentSourceAwsAssociation extends Construct {
  public readonly associationId: string;

  constructor(scope: Construct, id: string, props: DevOpsAgentSourceAwsAssociationProps) {
    super(scope, id);

    const association = new devopsagent.CfnAssociation(this, 'Resource', {
      agentSpaceId: props.agentSpaceId,
      serviceId: 'aws',
      configuration: {
        sourceAws: {
          accountId: props.accountId,
          accountType: 'source',
          assumableRoleArn: props.roleArn,
        },
      },
    });

    this.associationId = association.attrAssociationId;
  }
}
