import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { PipelineStack } from '../lib/stacks/pipeline/pipeline-stack';

describe('CDK Pipelines Mode - Pipeline Stack (Hub Model)', () => {
  let stack: PipelineStack;
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App();
    stack = new PipelineStack(app, 'TestPipeline', {
      env: { account: '000000000000', region: 'us-east-1' },
      projectName: 'TestAgent',
      pipelineConfig: {
        connection_arn:
          'arn:aws:codeconnections:us-east-1:000000000000:connection/12345678-abcd-efgh-ijkl-123456789012',
        provider: 'github',
        repo: 'test-org/devops-agent',
        branch: 'main',
        self_mutating: true,
      },
      deployOrder: [
        { environment: 'dev', manual_approval: false },
        { environment: 'qa', manual_approval: true },
        { environment: 'prd', manual_approval: true },
      ],
      environments: {
        dev: { account: '111111111111', region: 'us-east-1' },
        qa: { account: '222222222222', region: 'us-east-1' },
        prd: { account: '333333333333', region: 'us-east-1' },
      },
      agentSpaces: [
        {
          name: 'test-agent-nonprod',
          description: 'NonProd Agent Space',
          tier: 'nonprod',
          monitored_accounts: [
            { environment: 'dev', account_id: '111111111111', regions: ['us-east-1'] },
            { environment: 'qa', account_id: '222222222222', regions: ['us-east-1'] },
          ],
        },
        {
          name: 'test-agent-prod',
          description: 'Prod Agent Space',
          tier: 'prod',
          monitored_accounts: [
            { environment: 'prd', account_id: '333333333333', regions: ['us-east-1'] },
          ],
        },
      ],
    });
    template = Template.fromStack(stack);
  });

  test('Creates a CodePipeline', () => {
    template.hasResourceProperties('AWS::CodePipeline::Pipeline', {
      Name: 'TestAgent-pipeline',
    });
  });

  test('Pipeline has Source stage with CodeConnections', () => {
    template.hasResourceProperties('AWS::CodePipeline::Pipeline', {
      Stages: Match.arrayWith([
        Match.objectLike({
          Name: 'Source',
        }),
      ]),
    });
  });

  test('Pipeline has cross-account KMS key for deployments', () => {
    template.hasResource('AWS::KMS::Key', {});
  });

  test('Agent Space nested stacks are created in the pipeline stack', () => {
    // Agent Spaces are deployed as nested stacks (child constructs of PipelineStack)
    // Verify they exist by checking the construct tree
    const nonprodSpace = stack.node.tryFindChild('AgentSpace-nonprod');
    const prodSpace = stack.node.tryFindChild('AgentSpace-prod');
    expect(nonprodSpace).toBeDefined();
    expect(prodSpace).toBeDefined();
  });

  test('Agent Space nonprod template has correct resources', () => {
    // Get the nested stack template directly
    const nonprodStack = stack.node.tryFindChild('AgentSpace-nonprod') as cdk.Stack;
    const nonprodTemplate = Template.fromStack(nonprodStack);

    nonprodTemplate.hasResourceProperties('AWS::DevOpsAgent::AgentSpace', {
      Name: 'test-agent-nonprod',
    });

    // NonProd monitors dev + qa: 1 SourceAws + 2 Aws Associations = 3
    nonprodTemplate.resourceCountIs('AWS::DevOpsAgent::Association', 3);
  });

  test('Agent Space prod template has correct resources', () => {
    const prodStack = stack.node.tryFindChild('AgentSpace-prod') as cdk.Stack;
    const prodTemplate = Template.fromStack(prodStack);

    prodTemplate.hasResourceProperties('AWS::DevOpsAgent::AgentSpace', {
      Name: 'test-agent-prod',
    });

    // Prod monitors prd: 1 SourceAws + 1 Aws Association = 2
    prodTemplate.resourceCountIs('AWS::DevOpsAgent::Association', 2);
  });
});

describe('CDK Pipelines Mode - Without Agent Spaces', () => {
  test('Pipeline throws when deploy_order environment has no matching agent space', () => {
    const app = new cdk.App();
    expect(() => {
      new PipelineStack(app, 'PipelineNoAgent', {
        env: { account: '000000000000', region: 'us-east-1' },
        projectName: 'TestNoAgent',
        pipelineConfig: {
          connection_arn:
            'arn:aws:codeconnections:us-east-1:000000000000:connection/12345678-abcd-efgh-ijkl-123456789012',
          provider: 'github',
          repo: 'org/repo',
          branch: 'main',
          self_mutating: true,
        },
        deployOrder: [{ environment: 'dev', manual_approval: false }],
        environments: {
          dev: { account: '111111111111', region: 'us-east-1' },
        },
      });
    }).toThrow(/no agent_space monitors it/);
  });
});

describe('CDK Pipelines Mode - Validation', () => {
  test('Throws when deploy_order references undefined environment', () => {
    const app = new cdk.App();
    expect(() => {
      new PipelineStack(app, 'BadPipeline', {
        env: { account: '000000000000', region: 'us-east-1' },
        projectName: 'Test',
        pipelineConfig: {
          connection_arn: 'arn:aws:codeconnections:us-east-1:000000000000:connection/fake',
          provider: 'github',
          repo: 'org/repo',
          branch: 'main',
          self_mutating: true,
        },
        deployOrder: [{ environment: 'staging', manual_approval: false }],
        environments: {
          dev: { account: '111111111111', region: 'us-east-1' },
        },
        agentSpaces: [
          {
            name: 'test-space',
            tier: 'nonprod',
            monitored_accounts: [
              { environment: 'dev', account_id: '111111111111', regions: ['us-east-1'] },
            ],
          },
        ],
      });
    }).toThrow(/deploy_order references environment "staging"/);
  });
});
