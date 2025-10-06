import { APIGatewayProxyEvent } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { title } from "process";
import { STATUS_CODES } from "http";

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.TABLE_NAME!

export const handler = async (event: APIGatewayProxyEvent) => {
    try {
        const id = event.pathParameters?.id;
        if (!id) return { statusCode: 400, body: "Misisng id"};

        const out = await doc.send(new GetCommand({
            TableName: TABLE,
            Key: { PK: "PROJECT", SK: id},
        }));
    
        if (!out.Item) return { statusCode: 404, body: "Not found" };
        
        const it = out.Item as any;
        const project = {
            id: it.SK,
            title: it.title ?? it.SK,
            summary: it.summary ?? "",
            tags: Array.isArray(it.tags) ? it.tags : [],
            publishedAt: it.publishedAt ?? it.GSI1SK ?? null,
        };

        return {
            statusCode: 200,
            headers: {
                "Content-Type":"application/json",
                "Access-Control-Allow-Origin":"*"
            },
            body: JSON.stringify(project)
        };
    } catch (e) {
        console.error(e);
        return { 
            statusCode: 500, 
            headers:{ "Access-Control-Allow-Origin":"*" }, 
            body: JSON.stringify({error:"Internal"})
        };
    }
};