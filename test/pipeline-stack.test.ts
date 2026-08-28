import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { PipelineStack } from '../lib/stacks/pipeline/pipeline-stack';

function makeStack(): PipelineStack {
  const app = new cdk.App();
  return new PipelineStack(app, 'TestPipeline', {
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
      { environment: 'qa', manual_approval: false },
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
}

describe('CDK Pipelines Mode - Pipeline Stack (Hub Model)', () => {
  let template: Template;

  beforeAll(() => {
    template = Template.fromStack(makeStack());
  });

  test('Creates a CodePipeline', () => {
    template.hasResourceProperties('AWS::CodePipeline::Pipeline', {
      Name: 'TestAgent-pipeline',
    });
  });

  test('Pipeline has Source stage', () => {
    template.hasResourceProperties('AWS::CodePipeline::Pipeline', {
      Stages: Match.arrayWith([Match.objectLike({ Name: 'Source' })]),
    });
  });

  test('Pipeline has cross-account KMS key for deployments', () => {
    template.hasResource('AWS::KMS::Key', {});
  });

  test('Pipeline interleaves role and Agent Space stages per tier', () => {
    // Expected order: nonprod roles (dev, qa) → AgentSpace-nonprod
    //                 → prd role → AgentSpace-prod
    const pipeline = template.findResources('AWS::CodePipeline::Pipeline');
    const stages = Object.values(pipeline)[0].Properties.Stages.map(
      (s: { Name: string }) => s.Name,
    );

    const idxDev = stages.indexOf('Deploy-dev');
    const idxQa = stages.indexOf('Deploy-qa');
    const idxNonprod = stages.indexOf('AgentSpace-nonprod');
    const idxPrd = stages.indexOf('Deploy-prd');
    const idxProd = stages.indexOf('AgentSpace-prod');

    // All present
    expect(idxDev).toBeGreaterThan(-1);
    expect(idxQa).toBeGreaterThan(-1);
    expect(idxNonprod).toBeGreaterThan(-1);
    expect(idxPrd).toBeGreaterThan(-1);
    expect(idxProd).toBeGreaterThan(-1);

    // NonProd space deploys after its dev + qa roles
    expect(idxNonprod).toBeGreaterThan(idxDev);
    expect(idxNonprod).toBeGreaterThan(idxQa);

    // NonProd completes BEFORE the prd role/approval gate (delivery acceleration)
    expect(idxNonprod).toBeLessThan(idxPrd);

    // Prod space deploys after its prd role
    expect(idxProd).toBeGreaterThan(idxPrd);
  });
});

describe('CDK Pipelines Mode - Validation', () => {
  test('Throws when an agent space references an undefined environment', () => {
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
        deployOrder: [{ environment: 'dev', manual_approval: false }],
        environments: {
          dev: { account: '111111111111', region: 'us-east-1' },
        },
        agentSpaces: [
          {
            name: 'test-space',
            tier: 'nonprod',
            monitored_accounts: [
              { environment: 'staging', account_id: '999999999999', regions: ['us-east-1'] },
            ],
          },
        ],
      });
    }).toThrow(/references environment "staging"/);
  });
});
