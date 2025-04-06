import { tool, generateObject } from 'ai';
import { z } from 'zod';
import { generateUUID } from '@/lib/utils';
import { DataStreamWriter, CoreUserMessage } from 'ai';
import type { Session } from 'next-auth';
import {
  saveInvoice,
  saveLineItems,
} from '@/lib/db/queries';
import { invoiceDataSchema, extractInvoiceSchema } from '@/lib/ai/schemas/invoice-schema';
import { myProvider } from '@/lib/ai/models';

interface ProcessInvoiceDataProps {
  session: Session;
  dataStream: DataStreamWriter;
}

type InvoiceData = z.infer<typeof invoiceDataSchema>;

async function saveInvoiceToDatabase(
  invoiceData: InvoiceData,
  tokensUsed: number = 0
) {
  const invoiceId = generateUUID();
  
  // Save the invoice to the database
  const savedInvoice = await saveInvoice({
    id: invoiceId,
    customerName: invoiceData.customerName,
    vendorName: invoiceData.vendorName,
    invoiceNumber: invoiceData.invoiceNumber,
    invoiceDate: invoiceData.invoiceDate,
    dueDate: invoiceData.dueDate,
    amount: invoiceData.amount,
    currency: invoiceData.currency,
    tokensUsed,
    notes: invoiceData.notes,
  });
  
  // Save line items if present
  if (invoiceData.lineItems && invoiceData.lineItems.length > 0) {
    const lineItems = invoiceData.lineItems.map(item => ({
      ...item,
      id: generateUUID(),
      invoiceId,
    }));
    
    await saveLineItems({ items: lineItems });
  }

  return savedInvoice;
}

export const processInvoiceData = ({ session, dataStream }: ProcessInvoiceDataProps) =>
  tool({
    description:
      'Process and save invoice data from attached files to the database.',
    parameters: z.object({}),
    execute: async (_, { messages }) => {
      try {
        // Get the latest user message
        const latestUserMessage = (messages as CoreUserMessage[])
          .filter(msg => msg.role === 'user')
          .pop();

        if (!latestUserMessage || !Array.isArray(latestUserMessage.content)) {
          return {
            success: false,
            error: 'No valid files found',
            message: 'No files were found in the latest message.',
          };
        }

        // Extract files only from the latest message
        const attachedFiles = latestUserMessage.content
          .filter(part => part.type === 'file')
          .map(part => ({
            url: part.data,
            name: part.filename,
            contentType: part.mimeType
          }));
        
        if (attachedFiles.length === 0) {
          return {
            success: false,
            error: 'No valid files found',
            message: 'No files were found in the latest message.',
          };
        }

        // Process each attachment using generateObject
        const processedAttachments = [];
        for (const file of attachedFiles) {
          const { object, usage } = await generateObject({
            model: myProvider.languageModel('chat-model-anthropic'),
            system: 'Extract invoice data from the provided file. Focus on identifying key invoice details like customer name, vendor name, invoice number, dates, amounts, and line items.',
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: `Process the following file: ${file.name} (${file.contentType})`
                  },
                  {
                    type: 'file',
                    data: file.url,
                    filename: file.name,
                    mimeType: file.contentType
                  }
                ]
              }
            ],
            schema: extractInvoiceSchema,
          });

          if (object && object.invoiceData) {
            processedAttachments.push({
              file,
              invoiceData: object.invoiceData,
              tokensUsed: usage.totalTokens
            });
          }
        }

        // Signal saving start
        dataStream.writeData({
          type: 'savingStart',
          content: 'Saving invoice data to database...',
        });

        // Save each processed attachment that contains invoice data
        const savedInvoices = [];
        for (const attachment of processedAttachments) {
          const savedInvoice = await saveInvoiceToDatabase(
            attachment.invoiceData,
            attachment.tokensUsed
          );
          savedInvoices.push(savedInvoice);
        }
        
        // Send success message
        dataStream.writeData({
          type: 'savingComplete',
          content: 'Invoice saved successfully.',
        });
        
        return {
          success: true,
          message: 'Invoice data saved successfully.',
          savedInvoices,
        };
      } catch (error) {
        console.error('Error saving invoice data:', error);
        
        dataStream.writeData({
          type: 'error',
          content: 'Error saving invoice data.',
        });
        
        return {
          success: false,
          error: 'Database error',
          message: 'An error occurred while saving the invoice data. Please try again or contact support.',
        };
      }
    },
  }); 