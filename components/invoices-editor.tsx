"use client";

import { useState, useMemo, useCallback } from "react";
import { 
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
  ColumnDef
} from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InvoiceData } from "@/lib/ai/schemas/invoice-schema";
import { format, parse } from "date-fns";
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from "@/components/ui/accordion";
import { Card } from "@/components/ui/card";
import { Plus, Trash2, Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// Add custom column meta type
type ColumnMeta = {
  width?: string;
};

interface InvoicesEditorProps {
  invoices: Array<InvoiceData & { id: string }>;
}

export default function InvoicesEditor({ invoices: initialInvoices }: InvoicesEditorProps) {
  const [invoices, setInvoices] = useState(initialInvoices);
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'invoiceDate', desc: true }
  ]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<InvoiceData>>({});
  const [isUpdating, setIsUpdating] = useState(false);

  const columnHelper = createColumnHelper<InvoiceData & { id: string }>();
  
  // Add column width configuration
  const columnWidths = {
    vendorName: '180px',
    customerName: '180px', 
    invoiceNumber: '150px',
    invoiceDate: '120px',
    dueDate: '120px',
    amount: '150px',
    actions: '150px',
    toggleLineItems: '100px'
  };

  // Define cell render functions outside of useMemo to access latest state
  const renderVendorCell = useCallback(({ row }: any) => {
    const invoice = row.original;
    if (editingId !== invoice.id) return invoice.vendorName;
    
    return (
      <Input 
        key={`vendor-${invoice.id}`}
        defaultValue={editData.vendorName || ""}
        onBlur={(e) => handleInputChange("vendorName", e.target.value)}
        onChange={(e) => {
          // Update without re-rendering
          editData.vendorName = e.target.value;
        }}
      />
    );
  }, [editingId, editData.vendorName]);

  const renderCustomerCell = useCallback(({ row }: any) => {
    const invoice = row.original;
    if (editingId !== invoice.id) return invoice.customerName;
    
    return (
      <Input 
        key={`customer-${invoice.id}`}
        defaultValue={editData.customerName || ""}
        onBlur={(e) => handleInputChange("customerName", e.target.value)}
        onChange={(e) => {
          // Update without re-rendering
          editData.customerName = e.target.value;
        }}
      />
    );
  }, [editingId, editData.customerName]);

  const renderInvoiceNumberCell = useCallback(({ row }: any) => {
    const invoice = row.original;
    if (editingId !== invoice.id) return invoice.invoiceNumber;
    
    return (
      <Input 
        key={`number-${invoice.id}`}
        defaultValue={editData.invoiceNumber || ""}
        onBlur={(e) => handleInputChange("invoiceNumber", e.target.value)}
        onChange={(e) => {
          // Update without re-rendering
          editData.invoiceNumber = e.target.value;
        }}
      />
    );
  }, [editingId, editData.invoiceNumber]);

  const renderAmountCell = useCallback(({ row }: any) => {
    const invoice = row.original;
    if (editingId !== invoice.id) return `${invoice.currency || 'USD'} ${invoice.amount.toFixed(2)}`;
    
    return (
      <Input 
        key={`amount-${invoice.id}`}
        type="number"
        defaultValue={editData.amount || 0}
        onBlur={(e) => handleInputChange("amount", parseFloat(e.target.value))}
        onChange={(e) => {
          // Update without re-rendering
          editData.amount = parseFloat(e.target.value);
        }}
      />
    );
  }, [editingId, editData.amount]);

  const renderActionsCell = useCallback(({ row }: any) => {
    const invoice = row.original;
    return editingId === invoice.id ? (
      <div className="flex space-x-2">
        <Button size="sm" onClick={saveChanges} disabled={isUpdating}>
          {isUpdating ? 'Saving...' : 'Save'}
        </Button>
        <Button 
          size="sm" 
          variant="outline" 
          onClick={cancelEditing}
          disabled={isUpdating}
        >
          Cancel
        </Button>
      </div>
    ) : (
      <Button size="sm" onClick={() => startEditing(invoice)}>Edit</Button>
    );
  }, [editingId, isUpdating]);

  const renderLineItemsButton = useCallback(({ row }: any) => {
    const invoice = row.original;
    const itemCount = invoice.lineItems?.length || 0;
    
    return (
      <Button 
        variant="ghost" 
        size="sm"
        className="text-xs"
        onClick={() => toggleLineItems(invoice.id)}
      >
        {itemCount} item{itemCount !== 1 ? 's' : ''}
      </Button>
    );
  }, []);

  // Define columns with typed meta
  const columns = useMemo<ColumnDef<InvoiceData & { id: string }, any>[]>(() => [
    columnHelper.accessor('vendorName', {
      header: 'Vendor',
      cell: renderVendorCell,
      meta: { width: columnWidths.vendorName }
    }),
    columnHelper.accessor('customerName', {
      header: 'Customer',
      cell: renderCustomerCell,
      meta: { width: columnWidths.customerName }
    }),
    columnHelper.accessor('invoiceNumber', {
      header: 'Invoice Number',
      cell: renderInvoiceNumberCell,
      meta: { width: columnWidths.invoiceNumber }
    }),
    columnHelper.accessor('invoiceDate', {
      header: 'Invoice Date',
      cell: ({ row }) => {
        const invoice = row.original;
        if (editingId !== invoice.id) 
          return invoice.invoiceDate ? format(new Date(invoice.invoiceDate), 'MMM d, yyyy') : 'N/A';
        
        return (
          <div className="min-w-[150px]">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id={`invoice-date-${invoice.id}`}
                  variant={"outline"}
                  size="sm"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !editData.invoiceDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {editData.invoiceDate ? (
                    format(new Date(editData.invoiceDate), "MMM d, yyyy")
                  ) : (
                    <span>Pick a date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={editData.invoiceDate ? new Date(editData.invoiceDate) : undefined}
                  onSelect={(date) => {
                    if (date) {
                      editData.invoiceDate = date;
                      handleInputChange("invoiceDate", date);
                    }
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        );
      },
      meta: { width: columnWidths.invoiceDate }
    }),
    columnHelper.accessor('dueDate', {
      header: 'Due Date',
      cell: ({ row }) => {
        const invoice = row.original;
        if (editingId !== invoice.id)
          return invoice.dueDate ? format(new Date(invoice.dueDate), 'MMM d, yyyy') : 'N/A';
        
        return (
          <div className="min-w-[150px]">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id={`due-date-${invoice.id}`}
                  variant={"outline"}
                  size="sm"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !editData.dueDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {editData.dueDate ? (
                    format(new Date(editData.dueDate), "MMM d, yyyy")
                  ) : (
                    <span>Pick a date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={editData.dueDate ? new Date(editData.dueDate) : undefined}
                  onSelect={(date) => {
                    if (date) {
                      editData.dueDate = date;
                      handleInputChange("dueDate", date);
                    }
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        );
      },
      meta: { width: columnWidths.dueDate }
    }),
    columnHelper.accessor('amount', {
      header: 'Amount',
      cell: renderAmountCell,
      meta: { width: columnWidths.amount }
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Actions',
      cell: renderActionsCell,
      meta: { width: columnWidths.actions }
    }),
    columnHelper.display({
      id: 'toggleLineItems',
      header: 'Line Items',
      cell: renderLineItemsButton,
      meta: { width: columnWidths.toggleLineItems }
    })
  ], [editingId]);

  // Add state to track expanded rows
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  // Toggle line items visibility
  const toggleLineItems = (invoiceId: string) => {
    setExpandedRows(prev => ({
      ...prev,
      [invoiceId]: !prev[invoiceId]
    }));
  };

  const renderLineItems = (invoice: InvoiceData & { id: string }) => {
    const isEditing = editingId === invoice.id;
    const lineItems = isEditing ? editData.lineItems || [] : invoice.lineItems || [];
    
    return (
      <div className="space-y-3 py-2">
        {lineItems.map((item, index) => (
          <Card key={index} className="p-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs text-gray-500">Description</div>
                {isEditing ? (
                  <Input
                    value={item.description || ""}
                    onChange={(e) => handleLineItemChange(index, "description", e.target.value)}
                  />
                ) : (
                  <div>{item.description}</div>
                )}
              </div>
              <div>
                <div className="text-xs text-gray-500">Amount</div>
                {isEditing ? (
                  <Input
                    type="number"
                    value={item.amount || 0}
                    onChange={(e) => handleLineItemChange(index, "amount", parseFloat(e.target.value))}
                  />
                ) : (
                  <div>${item.amount.toFixed(2)}</div>
                )}
              </div>
              <div>
                <div className="text-xs text-gray-500">Quantity</div>
                {isEditing ? (
                  <Input
                    type="number"
                    value={item.quantity || 1}
                    onChange={(e) => handleLineItemChange(index, "quantity", parseFloat(e.target.value))}
                  />
                ) : (
                  <div>{item.quantity || 1}</div>
                )}
              </div>
              <div>
                <div className="text-xs text-gray-500">Unit Price</div>
                {isEditing ? (
                  <Input
                    type="number"
                    value={item.unitPrice || 0}
                    onChange={(e) => handleLineItemChange(index, "unitPrice", parseFloat(e.target.value))}
                  />
                ) : (
                  <div>${item.unitPrice?.toFixed(2) || "N/A"}</div>
                )}
              </div>
              {isEditing && (
                <Button 
                  variant="destructive" 
                  size="sm" 
                  className="col-span-2"
                  onClick={() => removeLineItem(index)}
                >
                  <Trash2 className="h-4 w-4 mr-1" /> Remove
                </Button>
              )}
            </div>
          </Card>
        ))}
        
        {isEditing && (
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full"
            onClick={addLineItem}
          >
            <Plus className="h-4 w-4 mr-1" /> Add Line Item
          </Button>
        )}
      </div>
    );
  };

  const handleLineItemChange = (index: number, field: string, value: any) => {
    const lineItems = [...(editData.lineItems || [])];
    lineItems[index] = { ...lineItems[index], [field]: value };
    setEditData(prev => ({ ...prev, lineItems }));
    
    // Recalculate total amount if needed
    if (field === 'amount' || field === 'quantity' || field === 'unitPrice') {
      const totalAmount = lineItems.reduce((sum, item) => sum + (item.amount || 0), 0);
      setEditData(prev => ({ ...prev, amount: totalAmount }));
    }
  };

  const addLineItem = () => {
    const lineItems = [...(editData.lineItems || [])];
    lineItems.push({
      description: '',
      quantity: 1,
      unitPrice: 0,
      amount: 0
    });
    setEditData(prev => ({ ...prev, lineItems }));
  };

  const removeLineItem = (index: number) => {
    const lineItems = [...(editData.lineItems || [])];
    lineItems.splice(index, 1);
    setEditData(prev => ({ ...prev, lineItems }));
    
    // Recalculate total amount
    const totalAmount = lineItems.reduce((sum, item) => sum + (item.amount || 0), 0);
    setEditData(prev => ({ ...prev, amount: totalAmount }));
  };

  const table = useReactTable({
    data: invoices,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    getCoreRowModel: getCoreRowModel(),
  });

  const startEditing = (invoice: InvoiceData & { id: string }) => {
    setEditingId(invoice.id);
    setEditData({
      customerName: invoice.customerName,
      vendorName: invoice.vendorName,
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate ? new Date(invoice.invoiceDate) : undefined,
      dueDate: invoice.dueDate ? new Date(invoice.dueDate) : undefined,
      amount: invoice.amount,
      currency: invoice.currency,
      lineItems: invoice.lineItems ? [...invoice.lineItems] : [],
    });
  };

  const handleInputChange = (field: keyof InvoiceData, value: any) => {
    setEditData(prev => ({ ...prev, [field]: value }));
  };

  const saveChanges = async () => {
    if (!editingId) return;
    
    try {
      setIsUpdating(true);
      
      const response = await fetch('/api/invoice', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: editingId,
          ...editData,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update invoice');
      }
      
      // Update local data
      setInvoices(invoices.map(inv => 
        inv.id === editingId ? { ...inv, ...editData } : inv
      ));
      
      // Reset editing state
      setEditingId(null);
      setEditData({});
    } catch (error) {
      console.error("Failed to update invoice:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditData({});
  };

  return (
    <div className="w-full overflow-auto">
      <h2 className="text-xl font-bold mb-4">Invoice Data</h2>
      <table className="w-full border-collapse table-fixed">
        <thead>
          {table.getHeaderGroups().map(headerGroup => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map(header => (
                <th 
                  key={header.id}
                  className="cursor-pointer text-left p-4 border-b whitespace-nowrap"
                  onClick={header.column.getToggleSortingHandler()}
                  style={{ 
                    width: (header.column.columnDef.meta as ColumnMeta)?.width,
                    minWidth: (header.column.columnDef.meta as ColumnMeta)?.width
                  }}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  {{
                    asc: ' 🔼',
                    desc: ' 🔽',
                  }[header.column.getIsSorted() as string] ?? null}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map(row => (
            <>
              <tr key={row.id} className="hover:bg-gray-50">
                {row.getVisibleCells().map(cell => (
                  <td 
                    key={cell.id} 
                    className="p-4 border-b whitespace-nowrap"
                    style={{ 
                      width: (cell.column.columnDef.meta as ColumnMeta)?.width,
                      minWidth: (cell.column.columnDef.meta as ColumnMeta)?.width
                    }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
              {expandedRows[row.original.id] && (
                <tr key={`${row.id}-expanded`}>
                  <td colSpan={row.getVisibleCells().length} className="bg-gray-50 p-0">
                    <div className="p-4">
                      <h4 className="font-medium mb-2">Line Items</h4>
                      {renderLineItems(row.original)}
                    </div>
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
} 