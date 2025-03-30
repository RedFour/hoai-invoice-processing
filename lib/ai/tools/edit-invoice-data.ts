import { tool } from 'ai';
import { z } from 'zod';
import { invoiceDataSchema } from './extract-invoice-data';

// This is a client-side tool that will trigger UI for editing invoice data
export const editInvoiceData = tool({
  description:
    'Allows the user to edit extracted invoice data before saving it to the database. This is a client-side tool that will display UI for editing the invoice data.',
  parameters: z.object({
    invoiceData: invoiceDataSchema.describe('The extracted invoice data to edit'),
    message: z.string().describe('A message explaining what needs to be reviewed or edited'),
  }),
}); 