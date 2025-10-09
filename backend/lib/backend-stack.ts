import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Table, AttributeType, BillingMode} from 'aws-cdk-lib/aws-dynamodb';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { RestApi, LambdaIntegration, Cors } from 'aws-cdk-lib/aws-apigateway';
import * as path from 'path';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ddb from 'aws-cdk-lib/aws-dynamodb';
import { RemovalPolicy } from 'aws-cdk-lib';

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

    // S3 bucket for docs
    const docsBucket = new s3.Bucket(this, 'DocsBucket', {
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // DynamoDB cache table
    const cacheTable = new ddb.Table(this, 'QaCache', {
      partitionKey: { name: 'pk', type: ddb.AttributeType.STRING },
      billingMode: ddb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      removalPolicy: RemovalPolicy.DESTROY,
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
      environment: { 
        TABLE_NAME: table.tableName,
        DDB_TABLE: cacheTable.tableName,
        S3_BUCKET: docsBucket.bucketName,
        CACHE_TTL_HOURS: process.env.CACHE_TTL_HOURS ?? '48',
        USE_RERANK: process.env.PG_CONN ?? '',
        PG_SCHEMA: process.env.PG_SCHEMA ?? 'public'
      },
      memorySize: 512,
    });
    table.grantWriteData(chatPost);
    cacheTable.grantReadWriteData(chatPost);
    docsBucket.grantRead(chatPost)

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
