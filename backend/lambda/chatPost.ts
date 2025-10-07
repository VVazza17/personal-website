import { APIGatewayProxyEvent } from "aws-lambda";
import { randomUUID } from "crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.TABLE_NAME!;

const CORS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
};

export const handler = async (event: APIGatewayProxyEvent) => {
    try {
        const body = event.body ? JSON.parse(event.body) : {};
        const { sessionId, message } = body;
        
        if (!sessionId || typeof message !== "string") { 
            return {
                statusCode: 400,
                headers: CORS, 
                body: JSON.stringify({ error: "sessionId and message are required" }), 
            };
        }

        const now = new Date().toISOString();
        const id  = randomUUID();

        await doc.send(new PutCommand({
        TableName: TABLE,
        Item: {
            PK: `CHAT#${sessionId}`,
            SK: `${now}#${id}`,
            type: "chat",
            role: "user",
            message,
            createdAt: now
        }
        }));

        return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({ reply: message, id, createdAt: now })
        };
    } catch (e) {
        console.error(e);
        return { 
            statusCode: 500, 
            headers: CORS, 
            body: JSON.stringify({ error:"Internal" }),
        };
    }
};
