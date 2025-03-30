import { tool } from 'ai';
import { z } from 'zod';
import { generateUUID } from '@/lib/utils';
import { DataStreamWriter } from 'ai';
import type { Session } from 'next-auth';
import {
  saveInvoice,
  saveLineItems,
} from '@/lib/db/queries';
import { invoiceDataSchema } from './extract-invoice-data';

interface SaveInvoiceDataProps {
  session: Session;
  dataStream: DataStreamWriter;
}

export const saveInvoiceData = ({ session, dataStream }: SaveInvoiceDataProps) =>
  tool({
    description:
      'Save extracted invoice data to the database. This tool should be used after the extractInvoiceData tool has successfully extracted and verified invoice information.',
    parameters: z.object({
      invoiceData: invoiceDataSchema.describe('The extracted and verified invoice data to save'),
      url: z.string().optional().describe('URL of the invoice file'),
      contentType: z.string().optional().describe('Content type of the file (e.g., "application/pdf", "image/jpeg")'),
      name: z.string().optional().describe('Name of the file'),
      fileSize: z.number().optional().describe('Original file size in bytes'),
      tokensUsed: z.number().optional().describe('Number of tokens used in the extraction process'),
      tokensCost: z.number().optional().describe('Cost of tokens used in the extraction process'),
    }),
    execute: async ({ 
      invoiceData, 
      url, 
      contentType, 
      name,
      fileSize,
      tokensUsed = 0,
      tokensCost = 0
    }) => {
      try {
        // Signal saving start
        dataStream.writeData({
          type: 'savingStart',
          content: 'Saving invoice data to database...',
        });
        
        // Generate ID for invoice
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
          filePath: url,
          fileType: contentType,
          fileSize,
          tokensUsed,
          tokensCost,
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
        
        // Send success message
        dataStream.writeData({
          type: 'savingComplete',
          content: 'Invoice saved successfully.',
        });
        
        return {
          success: true,
          invoice: savedInvoice,
          message: 'Invoice data saved successfully.',
          invoiceId,
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