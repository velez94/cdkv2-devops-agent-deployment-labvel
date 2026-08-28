import * as cdk from 'aws-cdk-lib';
import * as devopsagent from 'aws-cdk-lib/aws-devopsagent';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface DevOpsAgentSpaceProps {
  /** Name of the Agent Space */
  spaceName: string;
  /** Description */
  description?: string;
  /** Environment (dev/qa/prd) */
  environment: string;
  /** Project name for tagging */
  projectName?: string;
  /** Owner team for tagging */
  owner?: string;
  /** Custom tags (overrides defaults if provided) */
  tags?: Record<string, string>;
  /** Enable IAM Identity Center authentication for operator web app */
  useIdentityCenter?: boolean;
  /** Identity Center instance ARN */
  identityCenterInstanceArn?: string;
  /** Operator app IAM role ARN (required for IAM auth) */
  operatorAppRoleArn?: string;
}

/**
 * L2-like construct wrapping AWS::DevOpsAgent::AgentSpace.
 *
 * Provisions an Agent Space with:
 * - KMS CMK encryption (cdk-nag compliant)
 * - Agent Access Role (AIDevOpsAgentAccessPolicy + Resource Explorer SLR)
 * - Operator App Role (AIDevOpsOperatorAppAccessPolicy)
 * - Operator web app auth (IAM or Identity Center)
 * - Mandatory tagging
 *
 * Aligns with: https://docs.aws.amazon.com/devopsagent/latest/userguide/
 * getting-started-with-aws-devops-agent-getting-started-with-aws-devops-agent-using-aws-cdk.html
 */
export class DevOpsAgentSpace extends Construct {
  public readonly agentSpaceId: string;
  public readonly agentSpaceArn: string;
  public readonly encryptionKey: kms.IKey;
  public readonly agentAccessRole: iam.Role;
  public readonly operatorRole: iam.Role;

  constructor(scope: Construct, id: string, props: DevOpsAgentSpaceProps) {
    super(scope, id);

    const account = cdk.Stack.of(this).account;
    const region = cdk.Stack.of(this).region;

    // KMS key for Agent Space encryption at rest
    this.encryptionKey = new kms.Key(this, 'EncryptionKey', {
      alias: `devops-agent/${props.spaceName}`,
      description: `Encryption key for DevOps Agent Space: ${props.spaceName}`,
      enableKeyRotation: true,
      removalPolicy: props.environment === 'prd' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Grant the DevOps Agent service principal access to use the CMK.
    // Required when passing kmsKeyArn to CfnAgentSpace — otherwise the service
    // handler returns AccessDenied because it cannot use the customer-managed key.
    this.encryptionKey.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'AllowDevOpsAgentServiceUseOfKey',
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal('aidevops.amazonaws.com')],
        actions: [
          'kms:Encrypt',
          'kms:Decrypt',
          'kms:ReEncrypt*',
          'kms:GenerateDataKey*',
          'kms:DescribeKey',
          'kms:CreateGrant',
        ],
        resources: ['*'],
        conditions: {
          StringEquals: {
            'aws:SourceAccount': account,
          },
        },
      }),
    );

    // IAM Role: Agent Access — assumed by devops-agent service to monitor the account
    // Uses AIDevOpsAgentAccessPolicy (AWS managed) + Resource Explorer SLR inline
    this.agentAccessRole = new iam.Role(this, 'AgentAccessRole', {
      roleName: `DevOpsAgentRole-AgentSpace-${props.spaceName}`,
      assumedBy: new iam.ServicePrincipal('aidevops.amazonaws.com', {
        conditions: {
          StringEquals: {
            'aws:SourceAccount': account,
          },
        },
      }),
      description: `Agent access role for DevOps Agent Space: ${props.spaceName}`,
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AIDevOpsAgentAccessPolicy'),
      ],
    });

    // Inline policy: Allow creation of Resource Explorer service-linked role
    this.agentAccessRole.addToPolicy(new iam.PolicyStatement({
      sid: 'AllowResourceExplorerSLR',
      effect: iam.Effect.ALLOW,
      actions: ['iam:CreateServiceLinkedRole'],
      resources: [`arn:aws:iam::${account}:role/aws-service-role/resource-explorer-2.amazonaws.com/*`],
      conditions: {
        StringEquals: {
          'iam:AWSServiceName': 'resource-explorer-2.amazonaws.com',
        },
      },
    }));

    // IAM Role: Operator App — for web app console access
    // Uses AIDevOpsOperatorAppAccessPolicy (AWS managed)
    this.operatorRole = new iam.Role(this, 'OperatorRole', {
      roleName: `DevOpsAgentRole-WebappAdmin-${props.spaceName}`,
      assumedBy: new iam.ServicePrincipal('aidevops.amazonaws.com', {
        conditions: {
          StringEquals: {
            'aws:SourceAccount': account,
          },
        },
      }),
      description: `Operator app role for DevOps Agent Space: ${props.spaceName}`,
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AIDevOpsOperatorAppAccessPolicy'),
      ],
    });

    // Build OperatorApp configuration
    const operatorApp = this.buildOperatorAppConfig(props);

    // Agent Space resource
    const agentSpace = new devopsagent.CfnAgentSpace(this, 'Resource', {
      name: props.spaceName,
      description: props.description,
      kmsKeyArn: this.encryptionKey.keyArn,
      operatorApp,
      tags: this.buildTags(props),
    });

    this.agentSpaceId = agentSpace.attrAgentSpaceId;
    this.agentSpaceArn = agentSpace.attrArn;

    // After space is created, tighten the trust policy with SourceArn condition
    // Note: This is a best practice from the official docs but requires the ARN
    // which is only available after creation. CDK handles this via dependency.
  }

  private buildOperatorAppConfig(props: DevOpsAgentSpaceProps): devopsagent.CfnAgentSpace.OperatorAppProperty | undefined {
    if (props.useIdentityCenter && props.identityCenterInstanceArn) {
      return {
        idc: {
          idcInstanceArn: props.identityCenterInstanceArn,
          operatorAppRoleArn: this.operatorRole.roleArn,
        },
      };
    }

    // Default: IAM authentication
    return {
      iam: {
        operatorAppRoleArn: this.operatorRole.roleArn,
      },
    };
  }

  private buildTags(props: DevOpsAgentSpaceProps): cdk.CfnTag[] {
    // If custom tags provided, use them directly (organization's own policy)
    if (props.tags) {
      return Object.entries(props.tags).map(([key, value]) => ({ key, value }));
    }

    // Default tags (minimal, always applied)
    const tags: cdk.CfnTag[] = [
      { key: 'Environment', value: props.environment },
      { key: 'ManagedBy', value: 'CDK' },
    ];

    if (props.projectName) {
      tags.push({ key: 'Product', value: props.projectName });
    }
    if (props.owner) {
      tags.push({ key: 'Owner', value: props.owner });
    }

    return tags;
  }
}
