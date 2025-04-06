import { z } from 'zod';

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

export const extractInvoiceSchema = z.object({
  invoiceData: invoiceDataSchema,
  isInvoice: z.boolean().describe('Whether the document is a valid invoice or not.'),
  confidence: z.number().min(0).max(1).describe('Confidence score between 0 and 1 indicating how confident the model is about its extraction.'),
  reasoning: z.string().describe('Brief explanation of why the document is not considered an invoice. Only include this if the document is not an invoice.')
});

export type InvoiceData = z.infer<typeof invoiceDataSchema>; 