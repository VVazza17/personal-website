import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Table, AttributeType, BillingMode} from 'aws-cdk-lib/aws-dynamodb';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { RestApi, LambdaIntegration, Cors } from 'aws-cdk-lib/aws-apigateway';
import * as path from 'path';

export class BackendStack extends cdk.Stack {
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
      sortKey: { name: 'GSI1SK', type: AttributeType.STRING },
    });

    // GET /projects
    const projectsGetAll = new NodejsFunction(this, 'ProjectsGetAll', {
      entry: path.join(__dirname, '..', 'lambda', 'projectsGetAll.ts'),
      runtime: Runtime.NODEJS_20_X,
      environment: { TABLE_NAME: table.tableName, GSI1_NAME: 'GSI1' }
    });
    table.grantReadData(projectsGetAll);

    // GET /projects/{id} 
    const projectsGetById = new NodejsFunction(this, 'ProjectsGetById', {
      entry: path.join(__dirname, '..', 'lambda', 'projectsGetById.ts'),
      runtime: Runtime.NODEJS_20_X,
      environment: { TABLE_NAME: table.tableName }
    });
    table.grantReadData(projectsGetById);

    // POST /contact
    const contactPost = new NodejsFunction(this, "ContactPost", {
      entry: path.join(__dirname, "..", "lambda", "contactPost.ts"),
      runtime: Runtime.NODEJS_20_X,
      environment: { TABLE_NAME: table.tableName },
    });
    table.grantWriteData(contactPost);

    // POST /chat
    const chatPost = new NodejsFunction(this, "ChatPost", {
      entry: path.join(__dirname, "..", "lambda", "chatPost.ts"),
      runtime: Runtime.NODEJS_20_X,
      environment: { TABLE_NAME: table.tableName },
    });
    table.grantWriteData(chatPost);

    const api = new RestApi(this, 'PersonalSiteApi', {
      defaultCorsPreflightOptions: {
        allowOrigins: Cors.ALL_ORIGINS,
        allowMethods: Cors.ALL_METHODS,
        allowHeaders: ["Content-Type", "Authorization"]
      }
    });

    // /projects
    const projects = api.root.addResource('projects');
    projects.addMethod('GET', new LambdaIntegration(projectsGetAll));

    // /projects/{id}
    const projectById = projects.addResource('{id}');
    projectById.addMethod('GET', new LambdaIntegration(projectsGetById));

    // /contact
    const contact = api.root.addResource('contact');
    contact.addMethod('POST', new LambdaIntegration(contactPost));

    // /chat
    const chat = api.root.addResource('chat');
    chat.addMethod('POST', new LambdaIntegration(chatPost));
  }
}
