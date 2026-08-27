import * as cdk from 'aws-cdk-lib';
import { Annotations, Match } from 'aws-cdk-lib/assertions';
import { AwsSolutionsChecks } from 'cdk-nag';
import { FoundationStack } from '../lib/stacks/foundation/foundation-stack';

describe('cdk-nag AwsSolutions compliance', () => {
  let stack: cdk.Stack;

  beforeAll(() => {
    const app = new cdk.App();
    stack = new FoundationStack(app, 'TestNag', {
      projectName: 'Test',
      environment: 'dev',
    });
    // cdk-nag v3: instantiate with scope directly
    new AwsSolutionsChecks(app, { verbose: true });
    // Force synthesis to trigger validation
    app.synth();
  });

  test('No cdk-nag errors', () => {
    const errors = Annotations.fromStack(stack).findError(
      '*',
      Match.stringLikeRegexp('AwsSolutions-.*'),
    );
    expect(errors).toHaveLength(0);
  });

  test('No cdk-nag warnings (informational only)', () => {
    const warnings = Annotations.fromStack(stack).findWarning(
      '*',
      Match.stringLikeRegexp('AwsSolutions-.*'),
    );
    // Warnings are acceptable but should be reviewed
    if (warnings.length > 0) {
      console.log(
        `cdk-nag warnings (${warnings.length}):`,
        warnings.map((w) => w.entry.data),
      );
    }
  });
});
