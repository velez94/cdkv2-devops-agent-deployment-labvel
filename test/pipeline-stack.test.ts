import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { PipelineStack } from '../lib/stacks/pipeline/pipeline-stack';

describe('CDK Pipelines Mode - Pipeline Stack (Hub Model)', () => {
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App();
    const stack = new PipelineStack(app, 'TestPipeline', {
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

  test('Agent Spaces are deployed in the pipeline stack (hub account)', () => {
    // Both Agent Spaces should create their KMS keys in this stack
    template.hasResourceProperties('AWS::DevOpsAgent::AgentSpace', {
      Name: 'test-agent-nonprod',
    });
    template.hasResourceProperties('AWS::DevOpsAgent::AgentSpace', {
      Name: 'test-agent-prod',
    });
  });

  test('Agent Spaces have cross-account associations', () => {
    // NonProd monitors dev + qa (2 associations + 1 SourceAws each = at least 4)
    // Prod monitors prd (1 association + 1 SourceAws = 2)
    template.resourceCountIs('AWS::DevOpsAgent::Association', 6);
  });
});

describe('CDK Pipelines Mode - Without Agent Spaces', () => {
  test('Pipeline works without agentSpaces but requires at least env mapping', () => {
    const app = new cdk.App();
    // Without agentSpaces, the pipeline should throw because deploy_order
    // environments can't be mapped to a space
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
