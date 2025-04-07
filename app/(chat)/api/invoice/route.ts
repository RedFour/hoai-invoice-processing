import { NextResponse } from 'next/server';
import { 
  updateInvoice as updateInvoiceQuery,
  getInvoices as getInvoicesQuery,
  deleteLineItemsByInvoiceId,
  saveLineItems
} from '@/lib/db/queries';
import { generateUUID } from '@/lib/utils';

// GET handler to fetch invoices
export async function GET() {
  try {
    const invoices = await getInvoicesQuery();
    return NextResponse.json(invoices);
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invoices' }, 
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { 
      id, 
      customerName, 
      vendorName, 
      invoiceNumber, 
      invoiceDate, 
      dueDate, 
      amount, 
      currency,
      lineItems
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Invoice ID is required' }, 
        { status: 400 }
      );
    }

    // Convert dates if they're strings
    const parsedInvoiceDate = typeof invoiceDate === 'string' ? new Date(invoiceDate) : invoiceDate;
    const parsedDueDate = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;

    // Update invoice basic info
    const updatedInvoice = await updateInvoiceQuery({
      id,
      customerName,
      vendorName,
      invoiceNumber,
      invoiceDate: parsedInvoiceDate,
      dueDate: parsedDueDate,
      amount,
      currency
    });

    // Handle line items separately if provided
    if (lineItems && Array.isArray(lineItems)) {
      // Remove existing line items
      await deleteLineItemsByInvoiceId({ invoiceId: id });
      
      // Add new line items
      if (lineItems.length > 0) {
        const formattedLineItems = lineItems.map(item => ({
          ...item,
          id: item.id || generateUUID(),
          invoiceId: id
        }));
        
        await saveLineItems({ items: formattedLineItems });
      }
    }

    return NextResponse.json({
      ...updatedInvoice,
      lineItems
    });
  } catch (error) {
    console.error('Error updating invoice:', error);
    return NextResponse.json(
      { error: 'Failed to update invoice' }, 
      { status: 500 }
    );
  }
} 