import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface DevOpsAgentObservabilityProps {
  /** Agent Space name (for dashboard title) */
  spaceName: string;
  /** Monthly budget alarm threshold in USD */
  monthlyBudgetUsd?: number;
  /** SNS topic ARN for alerts (optional — creates one if not provided) */
  alertTopicArn?: string;
  /** Environment */
  environment: string;
}

/**
 * Observability construct for monitoring the AWS DevOps Agent itself.
 *
 * Provisions:
 * - CloudWatch Dashboard (agent health, investigation count, cost)
 * - Billing alarm (DevOps Agent spend threshold)
 * - CloudTrail metric filters (API errors, throttling)
 * - SNS topic for alerting
 */
export class DevOpsAgentObservability extends Construct {
  public readonly dashboard: cloudwatch.Dashboard;
  public readonly alertTopic: sns.ITopic;

  constructor(scope: Construct, id: string, props: DevOpsAgentObservabilityProps) {
    super(scope, id);

    // SNS topic for agent alerts
    if (props.alertTopicArn) {
      this.alertTopic = sns.Topic.fromTopicArn(this, 'AlertTopic', props.alertTopicArn);
    } else {
      this.alertTopic = new sns.Topic(this, 'AlertTopic', {
        topicName: `devops-agent-${props.spaceName}-alerts`,
        displayName: `DevOps Agent Alerts (${props.spaceName})`,
      });
    }

    // CloudTrail log group for agent API calls
    const trailLogGroup = new logs.LogGroup(this, 'AgentApiLogs', {
      logGroupName: `/aws/cloudtrail/devops-agent/${props.spaceName}`,
      retention: logs.RetentionDays.THREE_MONTHS,
      removalPolicy: props.environment === 'prd' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Metric filter: API errors
    const apiErrorFilter = new logs.MetricFilter(this, 'ApiErrorFilter', {
      logGroup: trailLogGroup,
      metricNamespace: 'DevOpsAgent/Custom',
      metricName: 'ApiErrors',
      filterPattern: logs.FilterPattern.literal('{ $.errorCode = "*" && $.eventSource = "aidevops.amazonaws.com" }'),
      metricValue: '1',
    });

    // Metric filter: Throttling
    const throttleFilter = new logs.MetricFilter(this, 'ThrottleFilter', {
      logGroup: trailLogGroup,
      metricNamespace: 'DevOpsAgent/Custom',
      metricName: 'ThrottledRequests',
      filterPattern: logs.FilterPattern.literal('{ $.errorCode = "ThrottlingException" && $.eventSource = "aidevops.amazonaws.com" }'),
      metricValue: '1',
    });

    // Alarm: API errors spike
    const apiErrorAlarm = new cloudwatch.Alarm(this, 'ApiErrorAlarm', {
      alarmName: `devops-agent-${props.spaceName}-api-errors`,
      alarmDescription: `DevOps Agent API errors exceed threshold for ${props.spaceName}`,
      metric: apiErrorFilter.metric({
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 10,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    apiErrorAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alertTopic));

    // Alarm: Throttling
    const throttleAlarm = new cloudwatch.Alarm(this, 'ThrottleAlarm', {
      alarmName: `devops-agent-${props.spaceName}-throttling`,
      alarmDescription: `DevOps Agent requests being throttled for ${props.spaceName}`,
      metric: throttleFilter.metric({
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 5,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    throttleAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alertTopic));

    // Dashboard
    this.dashboard = new cloudwatch.Dashboard(this, 'Dashboard', {
      dashboardName: `DevOpsAgent-${props.spaceName}`,
    });

    this.dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: `# DevOps Agent: ${props.spaceName}\nMeta-observability dashboard for the agent itself.`,
        width: 24,
        height: 2,
      }),
    );

    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Agent API Errors (5min)',
        left: [apiErrorFilter.metric({ statistic: 'Sum', period: cdk.Duration.minutes(5) })],
        width: 8,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'Throttled Requests (5min)',
        left: [throttleFilter.metric({ statistic: 'Sum', period: cdk.Duration.minutes(5) })],
        width: 8,
        height: 6,
      }),
      new cloudwatch.AlarmStatusWidget({
        title: 'Agent Health',
        alarms: [apiErrorAlarm, throttleAlarm],
        width: 8,
        height: 6,
      }),
    );
  }
}
