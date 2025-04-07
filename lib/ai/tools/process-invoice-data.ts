import { tool, generateObject } from 'ai';
import { z } from 'zod';
import { generateUUID } from '@/lib/utils';
import { DataStreamWriter, CoreUserMessage } from 'ai';
import type { Session } from 'next-auth';
import {
  saveInvoice,
  saveLineItems,
  findDuplicateInvoice,
} from '@/lib/db/queries';
import { invoiceDataSchema, extractInvoiceSchema } from '@/lib/ai/schemas/invoice-schema';
import { myProvider } from '@/lib/ai/models';
import { invoiceSystemPrompt } from '../prompts';

interface ProcessInvoiceDataProps {
  session: Session;
  dataStream: DataStreamWriter;
}

type InvoiceData = z.infer<typeof invoiceDataSchema>;

// Helper function to convert Date objects to ISO strings for JSON serialization
function serializeInvoice(invoice: any) {
  return {
    ...invoice,
    invoiceDate: invoice.invoiceDate instanceof Date 
      ? invoice.invoiceDate.toISOString() 
      : invoice.invoiceDate,
    dueDate: invoice.dueDate instanceof Date 
      ? invoice.dueDate.toISOString() 
      : invoice.dueDate,
  };
}

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

  return { ...savedInvoice, id: invoiceId };
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
        const invoiceAttachments = [];
        const nonInvoiceAttachments = [];
        for (const file of attachedFiles) {
          const { object, usage } = await generateObject({
            model: myProvider.languageModel('chat-model-anthropic'),
            system: invoiceSystemPrompt,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: 'Process the following file'
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

          if (object && object.invoiceData && object.isInvoice && object.confidence > 0.75) {
            invoiceAttachments.push({
              fileName: file.name,
              invoiceData: object.invoiceData,
              tokensUsed: usage.totalTokens
            });
          } else {
            nonInvoiceAttachments.push({
              fileName: file.name,
              reasoning: object.reasoning,
            });
          }
        }

        if (invoiceAttachments.length === 0) {
          return {
            success: false,
            error: 'No invoice data found',
            message: 'No invoice data was found in the uploaded files.',
          };
        }

        // Save each processed attachment that contains invoice data
        const savedInvoices = [];
        const duplicateInvoices = [];

        for (const attachment of invoiceAttachments) {
          const { invoiceData } = attachment;
          
          // Check for duplicate invoice
          const duplicate = await findDuplicateInvoice({
            vendorName: invoiceData.vendorName,
            invoiceNumber: invoiceData.invoiceNumber,
            amount: invoiceData.amount,
          });

          if (duplicate) {
            duplicateInvoices.push({
              fileName: attachment.fileName,
              invoiceData: attachment.invoiceData,
              existingInvoice: duplicate,
            });
            continue;
          }

          const savedInvoice = await saveInvoiceToDatabase(
            invoiceData,
            attachment.tokensUsed
          );
          
          savedInvoices.push({
            ...invoiceData,
            id: savedInvoice.id
          });
        }

        // Render InvoicesEditor component for saved invoices
        if (savedInvoices.length > 0) {
          // Serialize data with dates converted to ISO strings
          const serializedInvoices = savedInvoices.map(serializeInvoice);
          
          dataStream.writeData({
            type: 'invoiceTable',
            content: {
              invoices: serializedInvoices
            }
          });
        }
        
        let messageContent = '';
        
        if (savedInvoices.length > 0) {
          messageContent += `Successfully processed and saved ${savedInvoices.length} invoice(s).\n`;
        }
        
        if (duplicateInvoices.length > 0) {
          messageContent += `Found ${duplicateInvoices.length} duplicate invoice(s) that were not saved.\n`;
        }
        
        if (nonInvoiceAttachments.length > 0) {
          messageContent += `${nonInvoiceAttachments.length} file(s) did not contain recognizable invoice data.\n`;
        }
        
        return {
          success: true,
          message: messageContent.trim(),
          renderedComponent: {
            type: 'InvoicesEditor',
            invoices: savedInvoices.map(serializeInvoice)
          }
        };
      } catch (error) {
        console.error('Error saving invoice data:', error);
        
        dataStream.writeData({
          type: 'error',
          content: 'An error occurred while saving the invoice data. Please try again or contact support.',
        });
        
        return {
          success: false,
          error: 'Database error',
          message: 'An error occurred while saving the invoice data. Please try again or contact support.',
        };
      }
    },
  }); 