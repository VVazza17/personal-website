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
import { DockerImageFunction, DockerImageCode } from 'aws-cdk-lib/aws-lambda';

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

    // Embeddings Lambda
    const embedFn = new DockerImageFunction(this, 'EmbedFn', {
      code: DockerImageCode.fromImageAsset(path.join(__dirname, '..', '..', 'ml', 'embeddings')),
      memorySize: 1536,
      timeout: cdk.Duration.seconds(60),
      environment: { 
        EMBED_MODEL: 'intfloat/e5-small-v2',
        HF_HOME: '/tmp/hf',
        TRANSFORMERS_CACHE: '/tmp/hf/transformers',
        SENTENCE_TRANSFORMERS_HOME: '/tmp/hf/sentencetransformers',
        TORCH_HOME: '/tmp/hf/torch',
      },
    });

    // Reranker Lambda
    const rerankFn = new DockerImageFunction(this, "RerankFn", {
      code: DockerImageCode.fromImageAsset(path.join(__dirname, "..", "..", "ml", "reranker")),
      memorySize: 1536,
      timeout: cdk.Duration.seconds(60),
      environment: { RERANK_MODEL: "cross-encoder/ms-marco-MiniLM-L-6-v2" },
    });

    // Generator Lambda
    const genFn = new DockerImageFunction(this, "GenFn", {
      code: DockerImageCode.fromImageAsset(path.join(__dirname, "..", "..", "ml", "generator")),
      memorySize: 2048,
      timeout: cdk.Duration.seconds(60),
      environment: { GEN_MODEL: "google/flan-t5-small" },
    });

    // GET /projects
    const projectsGetAll = new NodejsFunction(this, 'ProjectsGetAll', {
      entry: path.join(__dirname, '..', 'lambda', 'projectsGetAll.ts'),
      runtime: Runtime.NODEJS_20_X,
      environment: { TABLE_NAME: table.tableName, GSI1_NAME: 'GSI1' }
    });
    table.grantReadData(projectsGetAll);

    // POST /chat
    const chatPost = new NodejsFunction(this, "ChatPost", {
      entry: path.join(__dirname, "..", "lambda", "chatPost.ts"),
      runtime: Runtime.NODEJS_20_X,
      environment: { 
        TABLE_NAME: table.tableName,
        DDB_TABLE: cacheTable.tableName,
        S3_BUCKET: docsBucket.bucketName,
        CACHE_TTL_HOURS: process.env.CACHE_TTL_HOURS ?? '48',
        USE_RERANK: process.env.USE_RERANK ?? 'false',
        PG_SCHEMA: process.env.PG_SCHEMA ?? 'public',
        PG_CONN: process.env.PG_CONN ?? '',
        EMBED_FN_NAME: embedFn.functionName,
        RERANK_FN_NAME: rerankFn.functionName,
        GEN_FN_NAME: genFn.functionName,
      },
      memorySize: 1024,
      timeout: cdk.Duration.seconds(45),
    });
    table.grantWriteData(chatPost);
    cacheTable.grantReadWriteData(chatPost);
    docsBucket.grantRead(chatPost)
    embedFn.grantInvoke(chatPost);
    rerankFn.grantInvoke(chatPost);
    chatPost.addEnvironment("RERANK_FN_NAME", rerankFn.functionName);
    genFn.grantInvoke(chatPost);
    chatPost.addEnvironment("GEN_FN_NAME", genFn.functionName);

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

    // /chat
    const chat = api.root.addResource('chat');
    chat.addMethod('POST', new LambdaIntegration(chatPost));
  }
}
