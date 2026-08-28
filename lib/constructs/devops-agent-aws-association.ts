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
 * L2-like construct wrapping AWS::DevOpsAgent::Association for a REMOTE (cross-account) account.
 *
 * For accounts OTHER than the one where the Agent Space lives, DevOps Agent
 * uses the "SourceAws" configuration with accountType "source".
 *
 * The IAM role referenced by assumableRoleArn MUST already exist in the target
 * account and trust the Agent Space ARN (via aws:SourceArn condition). If the
 * role is missing or its trust policy does not reference the Agent Space, the
 * service returns "Cross-account pass role is not allowed."
 *
 * Ref: https://docs.aws.amazon.com/devopsagent/latest/userguide/
 * getting-started-with-aws-devops-agent-getting-started-with-aws-devops-agent-using-aws-cloudformation.html
 * (Part 2: cross-account monitoring uses SourceAws/source)
 */
export class DevOpsAgentAwsAssociation extends Construct {
  public readonly associationId: string;

  constructor(scope: Construct, id: string, props: DevOpsAgentAwsAssociationProps) {
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

export interface DevOpsAgentSourceAwsAssociationProps {
  /** Agent Space ID to associate with */
  agentSpaceId: string;
  /** The hosting (source) account ID where the Agent Space lives */
  accountId: string;
  /** IAM role ARN the agent assumes in the source account */
  roleArn: string;
}

/**
 * L2-like construct wrapping AWS::DevOpsAgent::Association for the HOSTING account.
 *
 * The hosting account (where the Agent Space is deployed) uses the "Aws"
 * configuration with accountType "monitor". This enables the agent to monitor
 * the hosting account's own resources.
 *
 * Ref: https://docs.aws.amazon.com/devopsagent/latest/userguide/
 * getting-started-with-aws-devops-agent-getting-started-with-aws-devops-agent-using-aws-cloudformation.html
 * (Part 1: the hosting account uses Aws/monitor)
 */
export class DevOpsAgentSourceAwsAssociation extends Construct {
  public readonly associationId: string;

  constructor(scope: Construct, id: string, props: DevOpsAgentSourceAwsAssociationProps) {
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
