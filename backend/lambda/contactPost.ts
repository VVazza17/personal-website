import { APIGatewayProxyEvent } from "aws-lambda";
import { randomUUID } from "crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.TABLE_NAME!;

export const handler = async (event: APIGatewayProxyEvent) => {
    try {
        const body = event.body ? JSON.parse(event.body) : {};
        const { name, email, message } = body;
        
        if (!email || !message) return { statusCode: 400, body: "email and message are required" };

        const now = new Date().toISOString();
        const id  = randomUUID();

        await doc.send(new PutCommand({
        TableName: TABLE,
        Item: {
            PK: "CONTACT",
            SK: `${now}#${id}`,
            type: "contact",
            name: name ?? null,
            email,
            message,
            createdAt: now
        }
        }));

        return {
        statusCode: 201,
        headers: { 
            "Content-Type":"application/json", 
            "Access-Control-Allow-Origin":"*" 
        },
        body: JSON.stringify({ id, createdAt: now })
        };
    } catch (e) {
        console.error(e);
        return { 
            statusCode: 500, 
            headers:{ "Access-Control-Allow-Origin":"*" }, 
            body: JSON.stringify({ error:"Internal" }) 
        };
    }
};
