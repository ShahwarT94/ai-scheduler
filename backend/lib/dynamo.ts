import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
  BatchWriteCommand,
  TransactWriteCommand,
  type GetCommandInput,
  type PutCommandInput,
  type QueryCommandInput,
  type UpdateCommandInput,
  type DeleteCommandInput,
  type BatchWriteCommandInput,
  type TransactWriteCommandInput,
} from "@aws-sdk/lib-dynamodb";

// ─── Client setup ─────────────────────────────────────────────────────────────
// Single client instance reused across Lambda warm invocations.

const client = new DynamoDBClient({
  region: process.env.AWS_REGION ?? "us-east-1",
});

export const db = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,   // strip undefined fields automatically
    convertEmptyValues: false,
  },
});

export const TABLE = process.env.DYNAMODB_TABLE ?? "ai-scheduler";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Fetch a single item by PK + SK. Returns undefined if not found. */
export async function getItem<T>(
  pk: string,
  sk: string
): Promise<T | undefined> {
  const input: GetCommandInput = {
    TableName: TABLE,
    Key: { PK: pk, SK: sk },
  };
  const result = await db.send(new GetCommand(input));
  return result.Item as T | undefined;
}

/** Write a single item. Overwrites by default. */
export async function putItem(item: Record<string, unknown>): Promise<void> {
  const input: PutCommandInput = {
    TableName: TABLE,
    Item: item,
  };
  await db.send(new PutCommand(input));
}

/** Query items by PK, with optional SK prefix or condition. */
export async function queryItems<T>(
  pk: string,
  skPrefix?: string
): Promise<T[]> {
  const input: QueryCommandInput = {
    TableName: TABLE,
    KeyConditionExpression: skPrefix
      ? "PK = :pk AND begins_with(SK, :sk)"
      : "PK = :pk",
    ExpressionAttributeValues: skPrefix
      ? { ":pk": pk, ":sk": skPrefix }
      : { ":pk": pk },
  };
  const result = await db.send(new QueryCommand(input));
  return (result.Items ?? []) as T[];
}

/** Query a GSI by GSI1PK, with optional GSI1SK prefix. */
export async function queryByGSI<T>(
  gsi1pk: string,
  gsi1skPrefix?: string
): Promise<T[]> {
  const input: QueryCommandInput = {
    TableName: TABLE,
    IndexName: "GSI1",
    KeyConditionExpression: gsi1skPrefix
      ? "GSI1PK = :pk AND begins_with(GSI1SK, :sk)"
      : "GSI1PK = :pk",
    ExpressionAttributeValues: gsi1skPrefix
      ? { ":pk": gsi1pk, ":sk": gsi1skPrefix }
      : { ":pk": gsi1pk },
  };
  const result = await db.send(new QueryCommand(input));
  return (result.Items ?? []) as T[];
}

/** Update specific fields on an existing item. */
export async function updateItem(
  pk: string,
  sk: string,
  fields: Record<string, unknown>
): Promise<void> {
  const keys = Object.keys(fields);
  const expression = keys.map((k) => `#${k} = :${k}`).join(", ");
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};
  for (const k of keys) {
    names[`#${k}`] = k;
    values[`:${k}`] = fields[k];
  }
  const input: UpdateCommandInput = {
    TableName: TABLE,
    Key: { PK: pk, SK: sk },
    UpdateExpression: `SET ${expression}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
  };
  await db.send(new UpdateCommand(input));
}

/** Delete an item by PK + SK. */
export async function deleteItem(pk: string, sk: string): Promise<void> {
  const input: DeleteCommandInput = {
    TableName: TABLE,
    Key: { PK: pk, SK: sk },
  };
  await db.send(new DeleteCommand(input));
}

/**
 * Atomically writes a booking record AND updates a slot status to "booked",
 * but only if the slot's current status is "free".
 *
 * If the slot was already booked (race condition), DynamoDB cancels the
 * entire transaction and throws TransactionCanceledException with reason
 * ConditionalCheckFailed. The caller should catch SlotUnavailableError.
 */
export async function transactBookSlot(
  bookingItem: Record<string, unknown>,
  slotPK: string,
  slotSK: string
): Promise<void> {
  const input: TransactWriteCommandInput = {
    TransactItems: [
      // 1. Write the new booking record (fails if bookingId already exists — safety net)
      {
        Put: {
          TableName: TABLE,
          Item: bookingItem,
          ConditionExpression: "attribute_not_exists(PK)",
        },
      },
      // 2. Flip slot status free → booked, ONLY if it is currently free
      {
        Update: {
          TableName: TABLE,
          Key: { PK: slotPK, SK: slotSK },
          UpdateExpression: "SET #status = :booked",
          ConditionExpression: "#status = :free",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: { ":booked": "booked", ":free": "free" },
        },
      },
    ],
  };

  await db.send(new TransactWriteCommand(input));
}

/** Batch write up to 25 items at once. */
export async function batchPutItems(
  items: Record<string, unknown>[]
): Promise<void> {
  // DynamoDB batch write max = 25 items per call
  const chunks: Record<string, unknown>[][] = [];
  for (let i = 0; i < items.length; i += 25) {
    chunks.push(items.slice(i, i + 25));
  }

  for (const chunk of chunks) {
    const input: BatchWriteCommandInput = {
      RequestItems: {
        [TABLE]: chunk.map((item) => ({ PutRequest: { Item: item } })),
      },
    };
    await db.send(new BatchWriteCommand(input));
  }
}
