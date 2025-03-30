import { tool, DataStreamWriter, generateObject } from 'ai';
import { z } from 'zod';
import type { Session } from 'next-auth';
import { findDuplicateInvoice } from '@/lib/db/queries';
import { myProvider } from '@/lib/ai/models';

// Define Zod schemas that match the database schemas
export const lineItemSchema = z.object({
  description: z.string().describe('Description of the product or service provided'),
  quantity: z.number().optional().describe('Quantity of the product or service (optional)'),
  unitPrice: z.number().optional().describe('Price per unit of the product or service (optional)'),
  amount: z.number().describe('Total amount for this line item'),
  productCode: z.string().optional().describe('Product code or SKU (optional)'),
  taxRate: z.number().optional().describe('Tax rate applied to this line item (optional)'),
  metadata: z.record(z.any()).optional().describe('Additional information about the line item (optional)'),
});

export const invoiceDataSchema = z.object({
  customerName: z.string().describe('Name of the customer or client being billed'),
  vendorName: z.string().describe('Name of the company issuing the invoice'),
  invoiceNumber: z.string().describe('Unique identifier or reference number for the invoice'),
  invoiceDate: z.string().transform(str => new Date(str)).describe('Date when the invoice was issued (YYYY-MM-DD)'),
  dueDate: z.string().transform(str => new Date(str)).optional().describe('Date when the payment is due (YYYY-MM-DD, optional)'),
  amount: z.number().describe('Total amount of the invoice including all line items and taxes'),
  currency: z.string().default('USD').describe('Currency code for the invoice amounts (default: USD)'),
  lineItems: z.array(lineItemSchema).describe('List of products or services being billed'),
  notes: z.string().optional().describe('Additional notes or payment instructions (optional)'),
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
      url: z.string().describe('URL of the invoice file'),
      contentType: z.string().describe('Content type of the file (e.g., "application/pdf", "image/jpeg")'),
      name: z.string().optional().describe('Name of the file'),
    }),
    execute: async ({ url, contentType, name }) => {
      try {
        // Signal processing start
        dataStream.writeData({
          type: 'processingStart',
          content: 'Extracting invoice data...',
        });

        // Perform the actual extraction logic
        // In a real implementation, this would use vision models, OCR, etc.
        const extractionResult = await performInvoiceExtraction(url, contentType);
        
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
          fileName: name
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
async function performInvoiceExtraction(fileUrl: string, contentType: string): Promise<ExtractionResult> {
  try {
    console.log(`Extracting invoice data from file URL (${contentType})`);
    
    // Use generateObject with the provided model and schema to extract structured data
    const { object } = await generateObject({
      model: myProvider.languageModel('chat-model-anthropic'),
      system: `You are an expert at extracting structured data from invoices. 
        Extract all relevant information from the provided invoice document.
        Be precise and thorough in extracting customer name, vendor details, invoice numbers, dates, and line items.
        
        Critically assess if the document is actually an invoice. Provide a confidence score 
        between 0 and 1 about how certain you are about your extraction and assessment.
        A genuine invoice typically contains: an invoice number, vendor information, customer details,
        itemized charges, total amount, and date information.`,
      prompt: `Please analyze this document and extract all structured information if it is an invoice. 
        The file is provided in ${contentType} format. If it's not an invoice, explain why.
        The file is available at: ${fileUrl}`,
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