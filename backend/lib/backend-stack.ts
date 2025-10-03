import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Table, AttributeType, BillingMode} from 'aws-cdk-lib/aws-dynamodb';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { RestApi, LambdaIntegration } from 'aws-cdk-lib/aws-apigateway';
import * as path from 'path';

export class PersonalSiteBackendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const table = new Table(this, 'PersonalSiteTable', {
      partitionKey: { name: 'PK', type: AttributeType.STRING },
      sortKey: { name: 'SK', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
    });

    // Global Secondary Index (GSI)
    table.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'GSI1PK', type: AttributeType.STRING },
      sortKey: { name: 'GSISK', type: AttributeType.STRING },
    });

    const projectsGetAll = new NodejsFunction(this, 'ProjectsGetALl', {
      entry: path.join(__dirname, '..', 'lambda', 'projectsGetAll.ts'),
      runtime: Runtime.NODEJS_20_X,
      environment: { Table: table.tableName, GSI1: 'GSI1' }
    });

    table.grantReadData(projectsGetAll);

    const api = new RestApi(this, 'PersonalSiteApi');
    api.root.addResource('projects')
      .addMethod('GET', new LambdaIntegration(projectsGetAll));
  }
}
