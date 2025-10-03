import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const TABLE = process.env.TABLE!;
const GSI1 = process.env.GSI1!;

export const handler = async () => {
    try {
        const out = await doc.send(new QueryCommand({
            TableName: TABLE,
            IndexName: GSI1,
            KeyConditionExpression: "GSIPK = :g",
            ExpressionAttributeValues: { ":g": "PROJECT" },
            ScanIndexForward: false
        }));

        return {
            statusCode: 200,
            body: JSON.stringify(out.Items ?? [])
        };
    } catch (err) {
        console.log(err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Internal"})         
        };
    }
};