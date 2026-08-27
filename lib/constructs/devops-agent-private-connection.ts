import * as devopsagent from 'aws-cdk-lib/aws-devopsagent';
import { Construct } from 'constructs';

export interface DevOpsAgentPrivateConnectionProps {
  /** Name for the private connection (lowercase, alphanumeric, 3-30 chars) */
  name: string;
  /** Host address (IP or DNS) for the MCP server */
  hostAddress: string;
  /** VPC ID where the Resource Gateway will be created */
  vpcId: string;
  /** Subnet IDs for the Resource Gateway */
  subnetIds: string[];
  /** Security group IDs */
  securityGroupIds: string[];
  /** Port ranges (e.g., ['443', '8080-8090']) */
  portRanges?: string[];
  /** Optional TLS certificate (PEM format) */
  certificate?: string;
}

/**
 * L2-like construct wrapping AWS::DevOpsAgent::PrivateConnection.
 *
 * Creates a private network path between AWS DevOps Agent and your
 * MCP servers running in a VPC. Uses a service-managed Resource Gateway.
 */
export class DevOpsAgentPrivateConnection extends Construct {
  public readonly connectionArn: string;
  public readonly connectionName: string;

  constructor(scope: Construct, id: string, props: DevOpsAgentPrivateConnectionProps) {
    super(scope, id);

    const connection = new devopsagent.CfnPrivateConnection(this, 'Resource', {
      name: props.name,
      connectionConfiguration: {
        serviceManaged: {
          hostAddress: props.hostAddress,
          vpcId: props.vpcId,
          subnetIds: props.subnetIds,
          securityGroupIds: props.securityGroupIds,
          portRanges: props.portRanges ?? ['443'],
        },
      },
      ...(props.certificate && { certificate: props.certificate }),
    });

    this.connectionArn = connection.attrArn;
    this.connectionName = props.name;
  }
}
