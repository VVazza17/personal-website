import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const TABLE = process.env.TABLE_NAME!;
const GSI1 = process.env.GSI1_NAME!;

export const handler = async () => {
    try {
        const out = await doc.send(new QueryCommand({
            TableName: TABLE,
            IndexName: GSI1,
            KeyConditionExpression: "#g = :g",
            ExpressionAttributeNames: { "#g": "GSI1PK" },
            ExpressionAttributeValues: { ":g": "PROJECT" },
            ScanIndexForward: false
        }));

        const projects = (out.Items ?? []).map((it: any) => ({
            title: it.SK,
            tags: Array.isArray(it.tags) ? it.tags : [],
            summary: it.summary ?? "",
            publishedAt: it.GSI1SK ?? null
        }));

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(projects)
        };
    } catch (err) {
        console.log("GET /projects failed:", err);
        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: "Internal"})         
        };
    }
};