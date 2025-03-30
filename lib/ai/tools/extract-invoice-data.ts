import { tool, DataStreamWriter, generateObject } from 'ai';
import { z } from 'zod';
import type { Session } from 'next-auth';
import { findDuplicateInvoice } from '@/lib/db/queries';
import fs from 'fs/promises';
import { myProvider } from '@/lib/ai/models';

// Define Zod schemas that match the database schemas
export const lineItemSchema = z.object({
  description: z.string(),
  quantity: z.number().optional(),
  unitPrice: z.number().optional(),
  amount: z.number(),
  productCode: z.string().optional(),
  taxRate: z.number().optional(),
  metadata: z.record(z.any()).optional(),
});

export const invoiceDataSchema = z.object({
  customerName: z.string(),
  vendorName: z.string(),
  invoiceNumber: z.string(),
  invoiceDate: z.date(),
  dueDate: z.date().optional(),
  amount: z.number(),
  currency: z.string().default('USD'),
  lineItems: z.array(lineItemSchema),
  notes: z.string().optional(),
});

// Enhanced schema that includes AI assessment
export const invoiceSchema = z.object({
  data: invoiceDataSchema,
  isInvoice: z.boolean().describe('Whether the document is a valid invoice or not.'),
  confidence: z.number().min(0).max(1).describe('Confidence score between 0 and 1 indicating how confident the model is about its extraction.'),
  reasoning: z.string().describe('Brief explanation of why the document is or is not considered an invoice.')
});

export type ExtractedInvoiceData = z.infer<typeof invoiceDataSchema>;
export type InvoiceExtractionResult = z.infer<typeof invoiceSchema>;

interface ExtractInvoiceDataProps {
  session: Session;
  dataStream: DataStreamWriter;
}

export const extractInvoiceData = ({ session, dataStream }: ExtractInvoiceDataProps) =>
  tool({
    description:
      'Extract information from an invoice image or PDF such as customer name, vendor name, invoice number, invoice date, due date, amount, and line items. This tool does NOT save to the database, it only extracts the data for preview and verification.',
    parameters: z.object({
      filePath: z.string().describe('Path to the invoice file'),
      fileType: z.string().describe('File type (e.g., "pdf", "image/jpeg")'),
      fileSize: z.number().optional().describe('File size in bytes'),
    }),
    execute: async ({ filePath, fileType, fileSize }) => {
      try {
        // Signal processing start
        dataStream.writeData({
          type: 'processingStart',
          content: 'Extracting invoice data...',
        });

        // Perform the actual extraction logic
        // In a real implementation, this would use vision models, OCR, etc.
        const extractionResult = await performInvoiceExtraction(filePath, fileType);
        
        // Count tokens used for metrics
        const tokensUsed = calculateTokensUsed(extractionResult.data);
        const tokensCost = calculateTokensCost(tokensUsed);
        
        // Check if it's actually an invoice
        if (!extractionResult.isInvoice || extractionResult.confidence < 0.7) {
          dataStream.writeData({
            type: 'error',
            content: 'The uploaded document does not appear to be an invoice.',
          });
          
          return {
            success: false,
            error: 'Not an invoice',
            message: 'The document does not appear to be an invoice. Please upload a valid invoice document.',
          };
        }
        
        // Check for duplicates
        const possibleDuplicate = await findDuplicateInvoice({
          vendorName: extractionResult.data.vendorName,
          invoiceNumber: extractionResult.data.invoiceNumber,
          amount: extractionResult.data.amount,
        });
        
        if (possibleDuplicate) {
          dataStream.writeData({
            type: 'warning',
            content: 'Possible duplicate invoice detected.',
          });
          
          return {
            success: false,
            error: 'Duplicate invoice',
            message: 'This invoice appears to be a duplicate. We found an existing invoice with the same vendor name, invoice number, and amount.',
            duplicateId: possibleDuplicate.id,
          };
        }
        
        // Send completion message
        dataStream.writeData({
          type: 'extractionComplete',
          content: 'Invoice data extracted successfully.',
        });
        
        // Return the extracted data (without saving)
        return {
          success: true,
          extractedData: extractionResult.data,
          confidence: extractionResult.confidence,
          isInvoice: extractionResult.isInvoice,
          reasoning: extractionResult.reasoning,
          tokensUsed,
          tokensCost,
          message: 'Invoice data extracted successfully. Please review before saving.',
        };
      } catch (error) {
        console.error('Error extracting invoice data:', error);
        
        dataStream.writeData({
          type: 'error',
          content: 'Error extracting invoice data.',
        });
        
        return {
          success: false,
          error: 'Extraction error',
          message: 'An error occurred while extracting data from the invoice. Please try again or upload a clearer image.',
        };
      }
    },
  });

// Helper functions

interface ExtractionResult {
  isInvoice: boolean;
  confidence: number;
  data: ExtractedInvoiceData;
  reasoning?: string;
}

// This function implements invoice extraction using generateObject from Vercel AI SDK
async function performInvoiceExtraction(filePath: string, fileType: string): Promise<ExtractionResult> {
  try {
    console.log(`Extracting invoice data from: ${filePath} (${fileType})`);
    
    // Read the file content
    const fileContent = await fs.readFile(filePath);
    
    // Determine the MIME type based on fileType
    const mimeType = determineMimeType(fileType);
    
    // Use generateObject with the provided model and schema to extract structured data
    const { object } = await generateObject({
      model: myProvider.languageModel('chat-model-large'),
      system: `You are an expert at extracting structured data from invoices. 
        Extract all relevant information from the provided invoice document.
        Be precise and thorough in extracting customer name, vendor details, invoice numbers, dates, and line items.
        
        Critically assess if the document is actually an invoice. Provide a confidence score 
        between 0 and 1 about how certain you are about your extraction and assessment.
        A genuine invoice typically contains: an invoice number, vendor information, customer details,
        itemized charges, total amount, and date information.`,
      prompt: `Please analyze this document and extract all structured information if it is an invoice. 
        The file is provided in ${mimeType} format. If it's not an invoice, explain why.`,
      schema: invoiceSchema
    });
    
    // If we got valid data, return a successful result
    if (object) {
      return {
        isInvoice: object.isInvoice,
        confidence: object.confidence,
        data: object.data,
        reasoning: object.reasoning
      };
    } else {
      throw new Error('Failed to extract data from invoice');
    }
  } catch (error) {
    console.error('Error in invoice extraction:', error);
    
    // Return a fallback result on error
    return {
      isInvoice: false,
      confidence: 0.1,
      data: createEmptyInvoiceData(),
      reasoning: "Error occurred during extraction"
    };
  }
}

// Helper function to determine MIME type
function determineMimeType(fileType: string): string {
  const lowerFileType = fileType.toLowerCase();
  
  if (lowerFileType === 'pdf' || lowerFileType.includes('pdf')) {
    return 'application/pdf';
  } else if (lowerFileType.includes('image/')) {
    return lowerFileType; // Already a MIME type
  } else if (lowerFileType === 'jpg' || lowerFileType === 'jpeg') {
    return 'image/jpeg';
  } else if (lowerFileType === 'png') {
    return 'image/png';
  } else if (lowerFileType === 'tiff') {
    return 'image/tiff';
  } else {
    // Default to PDF if we can't determine
    return 'application/pdf';
  }
}

// Create empty invoice data for fallbacks
function createEmptyInvoiceData(): ExtractedInvoiceData {
  return {
    customerName: '',
    vendorName: '',
    invoiceNumber: '',
    invoiceDate: new Date(),
    amount: 0,
    currency: 'USD',
    lineItems: [],
  };
}

function calculateTokensUsed(data: ExtractedInvoiceData): number {
  // In a real implementation, you would get token usage from the model response
  // For now, estimate based on the complexity of the invoice
  const baseTokens = 500; // Base cost for processing
  const textTokens = JSON.stringify(data).length / 4; // Rough estimate
  const lineItemTokens = (data.lineItems?.length || 0) * 50; // Each line item costs tokens
  
  return Math.round(baseTokens + textTokens + lineItemTokens);
}

function calculateTokensCost(tokens: number): number {
  // Calculate cost based on your model's pricing
  return tokens * 0.00001;
} 