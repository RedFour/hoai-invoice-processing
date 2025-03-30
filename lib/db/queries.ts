import 'server-only';
import { and, asc, desc, eq, gt, gte, inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';

import {
  chat,
  document,
  type Suggestion,
  suggestion,
  type Message,
  message,
  vote,
  invoice,
  lineItem,
} from './schema';
import type { BlockKind } from '@/components/block';

// Optionally, if not using email/pass login, you can
// use the Drizzle adapter for Auth.js / NextAuth
// https://authjs.dev/reference/adapter/drizzle

// biome-ignore lint: Forbidden non-null assertion.
const sqlite = new Database('sqlite.db');
const db = drizzle(sqlite);

export async function saveChat({
  id,
  userId,
  title,
}: {
  id: string;
  userId: string;
  title: string;
}) {
  try {
    return await db.insert(chat).values({
      id,
      createdAt: new Date(),
      // userId,
      title,
    });
  } catch (error) {
    console.error('Failed to save chat in database');
    throw error;
  }
}

export async function deleteChatById({ id }: { id: string }) {
  try {
    await db.delete(vote).where(eq(vote.chatId, id));
    await db.delete(message).where(eq(message.chatId, id));

    return await db.delete(chat).where(eq(chat.id, id));
  } catch (error) {
    console.error('Failed to delete chat by id from database');
    throw error;
  }
}

export async function getChatsByUserId({ id }: { id: string }) {
  try {
    return await db
      .select()
      .from(chat)
      // .where(eq(chat.userId, id))
      .orderBy(desc(chat.createdAt));
  } catch (error) {
    console.error('Failed to get chats by user from database');
    throw error;
  }
}

export async function getChatById({ id }: { id: string }) {
  try {
    const [selectedChat] = await db.select().from(chat).where(eq(chat.id, id));
    return selectedChat;
  } catch (error) {
    console.error('Failed to get chat by id from database');
    throw error;
  }
}

export async function saveMessages({ messages }: { messages: Array<Message> }) {
  try {
    return await db.insert(message).values(messages);
  } catch (error) {
    console.error('Failed to save messages in database', error);
    throw error;
  }
}

export async function getMessagesByChatId({ id }: { id: string }) {
  try {
    return await db
      .select()
      .from(message)
      .where(eq(message.chatId, id))
      .orderBy(asc(message.createdAt));
  } catch (error) {
    console.error('Failed to get messages by chat id from database', error);
    throw error;
  }
}

export async function voteMessage({
  chatId,
  messageId,
  type,
}: {
  chatId: string;
  messageId: string;
  type: 'up' | 'down';
}) {
  try {
    const [existingVote] = await db
      .select()
      .from(vote)
      .where(and(eq(vote.messageId, messageId)));

    if (existingVote) {
      return await db
        .update(vote)
        .set({ isUpvoted: type === 'up' })
        .where(and(eq(vote.messageId, messageId), eq(vote.chatId, chatId)));
    }
    return await db.insert(vote).values({
      chatId,
      messageId,
      isUpvoted: type === 'up',
    });
  } catch (error) {
    console.error('Failed to upvote message in database', error);
    throw error;
  }
}

export async function getVotesByChatId({ id }: { id: string }) {
  try {
    return await db.select().from(vote).where(eq(vote.chatId, id));
  } catch (error) {
    console.error('Failed to get votes by chat id from database', error);
    throw error;
  }
}

export async function saveDocument({
  id,
  title,
  kind,
  content,
  userId,
}: {
  id: string;
  title: string;
  kind: BlockKind;
  content: string;
  userId: string;
}) {
  try {
    return await db.insert(document).values({
      id,
      title,
      kind,
      content,
      // userId,
      createdAt: new Date(),
    });
  } catch (error) {
    console.error('Failed to save document in database');
    throw error;
  }
}

export async function getDocumentsById({ id }: { id: string }) {
  try {
    const documents = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(asc(document.createdAt));

    return documents;
  } catch (error) {
    console.error('Failed to get document by id from database');
    throw error;
  }
}

export async function getDocumentById({ id }: { id: string }) {
  try {
    const [selectedDocument] = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(desc(document.createdAt));

    return selectedDocument;
  } catch (error) {
    console.error('Failed to get document by id from database');
    throw error;
  }
}

export async function deleteDocumentsByIdAfterTimestamp({
  id,
  timestamp,
}: {
  id: string;
  timestamp: Date;
}) {
  try {
    await db
      .delete(suggestion)
      .where(
        and(
          eq(suggestion.documentId, id),
          gt(suggestion.documentCreatedAt, timestamp),
        ),
      );

    return await db
      .delete(document)
      .where(and(eq(document.id, id), gt(document.createdAt, timestamp)));
  } catch (error) {
    console.error(
      'Failed to delete documents by id after timestamp from database',
    );
    throw error;
  }
}

export async function saveSuggestions({
  suggestions,
}: {
  suggestions: Array<Suggestion>;
}) {
  try {
    return await db.insert(suggestion).values(suggestions);
  } catch (error) {
    console.error('Failed to save suggestions in database');
    throw error;
  }
}

export async function getSuggestionsByDocumentId({
  documentId,
}: {
  documentId: string;
}) {
  try {
    return await db
      .select()
      .from(suggestion)
      .where(and(eq(suggestion.documentId, documentId)));
  } catch (error) {
    console.error(
      'Failed to get suggestions by document version from database',
    );
    throw error;
  }
}

export async function getMessageById({ id }: { id: string }) {
  try {
    return await db.select().from(message).where(eq(message.id, id));
  } catch (error) {
    console.error('Failed to get message by id from database');
    throw error;
  }
}

export async function deleteMessagesByChatIdAfterTimestamp({
  chatId,
  timestamp,
}: {
  chatId: string;
  timestamp: Date;
}) {
  try {
    const messagesToDelete = await db
      .select({ id: message.id })
      .from(message)
      .where(
        and(eq(message.chatId, chatId), gte(message.createdAt, timestamp)),
      );

    const messageIds = messagesToDelete.map((message) => message.id);

    if (messageIds.length > 0) {
      await db
        .delete(vote)
        .where(
          and(eq(vote.chatId, chatId), inArray(vote.messageId, messageIds)),
        );

      return await db
        .delete(message)
        .where(
          and(eq(message.chatId, chatId), inArray(message.id, messageIds)),
        );
    }
  } catch (error) {
    console.error(
      'Failed to delete messages by id after timestamp from database',
    );
    throw error;
  }
}

export async function updateChatVisiblityById({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: 'private' | 'public';
}) {
  try {
    return await db.update(chat).set({ visibility }).where(eq(chat.id, chatId));
  } catch (error) {
    console.error('Failed to update chat visibility in database');
    throw error;
  }
}

// Invoice queries
export async function saveInvoice({
  id,
  customerName,
  vendorName,
  invoiceNumber,
  invoiceDate,
  dueDate,
  amount,
  currency = 'USD',
  filePath,
  fileType,
  fileSize,
  tokensUsed,
  tokensCost,
  notes,
}: {
  id: string;
  customerName: string;
  vendorName: string;
  invoiceNumber: string;
  invoiceDate: Date;
  dueDate?: Date;
  amount: number;
  currency?: string;
  filePath?: string;
  fileType?: string;
  fileSize?: number;
  tokensUsed?: number;
  tokensCost?: number;
  notes?: string;
}) {
  return db
    .insert(invoice)
    .values({
      id,
      createdAt: new Date(),
      customerName,
      vendorName,
      invoiceNumber,
      invoiceDate,
      dueDate,
      amount,
      currency,
      filePath,
      fileType,
      fileSize,
      tokensUsed,
      tokensCost,
      notes,
      status: 'processed',
    })
    .returning()
    .get();
}

export async function updateInvoice({
  id,
  customerName,
  vendorName,
  invoiceNumber,
  invoiceDate,
  dueDate,
  amount,
  currency,
  status,
  notes,
}: {
  id: string;
  customerName?: string;
  vendorName?: string;
  invoiceNumber?: string;
  invoiceDate?: Date;
  dueDate?: Date;
  amount?: number;
  currency?: string;
  status?: 'processed' | 'pending' | 'error';
  notes?: string;
}) {
  const updateValues: Partial<typeof invoice.$inferInsert> = {};
  
  if (customerName !== undefined) updateValues.customerName = customerName;
  if (vendorName !== undefined) updateValues.vendorName = vendorName;
  if (invoiceNumber !== undefined) updateValues.invoiceNumber = invoiceNumber;
  if (invoiceDate !== undefined) updateValues.invoiceDate = invoiceDate;
  if (dueDate !== undefined) updateValues.dueDate = dueDate;
  if (amount !== undefined) updateValues.amount = amount;
  if (currency !== undefined) updateValues.currency = currency;
  if (status !== undefined) updateValues.status = status;
  if (notes !== undefined) updateValues.notes = notes;

  return db
    .update(invoice)
    .set(updateValues)
    .where(eq(invoice.id, id))
    .returning()
    .get();
}

export async function updateInvoiceTokenUsage({
  id,
  tokensUsed,
  tokensCost,
}: {
  id: string;
  tokensUsed: number;
  tokensCost: number;
}) {
  return db
    .update(invoice)
    .set({ tokensUsed, tokensCost })
    .where(eq(invoice.id, id))
    .returning()
    .get();
}

export async function getInvoiceById({ id }: { id: string }) {
  return db.select().from(invoice).where(eq(invoice.id, id)).get();
}

export async function getInvoices({
  limit = 100,
  offset = 0,
  orderBy = 'createdAt',
  orderDirection = 'desc',
}: {
  limit?: number;
  offset?: number;
  orderBy?: keyof typeof invoice.$inferSelect;
  orderDirection?: 'asc' | 'desc';
} = {}) {
  const orderColumn = invoice[orderBy];
  
  if (!orderColumn) {
    throw new Error(`Invalid order column: ${orderBy}`);
  }

  return db
    .select()
    .from(invoice)
    .limit(limit)
    .offset(offset)
    .orderBy(orderDirection === 'asc' ? asc(orderColumn) : desc(orderColumn))
    .all();
}

export async function findDuplicateInvoice({
  vendorName,
  invoiceNumber,
  amount,
}: {
  vendorName: string;
  invoiceNumber: string;
  amount: number;
}) {
  return db
    .select()
    .from(invoice)
    .where(
      and(
        eq(invoice.vendorName, vendorName),
        eq(invoice.invoiceNumber, invoiceNumber),
        eq(invoice.amount, amount)
      )
    )
    .get();
}

export async function deleteInvoiceById({ id }: { id: string }) {
  return db.delete(invoice).where(eq(invoice.id, id)).run();
}

// Line item queries
export async function saveLineItem({
  id,
  invoiceId,
  description,
  quantity,
  unitPrice,
  amount,
  productCode,
  taxRate,
  metadata,
}: {
  id: string;
  invoiceId: string;
  description: string;
  quantity?: number;
  unitPrice?: number;
  amount: number;
  productCode?: string;
  taxRate?: number;
  metadata?: Record<string, any>;
}) {
  return db
    .insert(lineItem)
    .values({
      id,
      invoiceId,
      description,
      quantity,
      unitPrice,
      amount,
      productCode,
      taxRate,
      metadata,
      createdAt: new Date(),
    })
    .returning()
    .get();
}

export async function saveLineItems({
  items,
}: {
  items: Array<{
    id: string;
    invoiceId: string;
    description: string;
    quantity?: number;
    unitPrice?: number;
    amount: number;
    productCode?: string;
    taxRate?: number;
    metadata?: Record<string, any>;
  }>;
}) {
  if (items.length === 0) return [];

  return db
    .insert(lineItem)
    .values(
      items.map((item) => ({
        ...item,
        createdAt: new Date(),
      }))
    )
    .returning()
    .all();
}

export async function getLineItemsByInvoiceId({
  invoiceId,
}: {
  invoiceId: string;
}) {
  return db
    .select()
    .from(lineItem)
    .where(eq(lineItem.invoiceId, invoiceId))
    .all();
}

export async function deleteLineItemsByInvoiceId({
  invoiceId,
}: {
  invoiceId: string;
}) {
  return db.delete(lineItem).where(eq(lineItem.invoiceId, invoiceId)).run();
}
