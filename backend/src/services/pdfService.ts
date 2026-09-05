import PDFDocument from 'pdfkit';
import { Response } from 'express';
import { env } from '../config/env';

interface InvoiceItem {
  medicineName: string;
  batchNumber: string;
  quantity: number;
  mrp: number;
  sellingPrice: number;
  discountPercent: number;
  gstPercent: number;
  lineTotal: number;
}

export interface InvoiceData {
  invoiceNumber: string;
  saleDate: Date;
  customerName: string;
  customerPhone?: string | null;
  items: InvoiceItem[];
  subTotal: number;
  discountAmount: number;
  gstAmount: number;
  totalAmount: number;
  paidAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  createdByName: string;
}

const inr = (n: number) => `Rs. ${n.toFixed(2)}`;

export function streamInvoicePdf(res: Response, invoice: InvoiceData) {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=${invoice.invoiceNumber}.pdf`);
  doc.pipe(res);

  // ---- Header: AR Medical branding ----
  doc
    .fillColor('#0f766e')
    .fontSize(22)
    .font('Helvetica-Bold')
    .text(env.business.name, { align: 'center' });
  doc
    .fillColor('#334155')
    .fontSize(10)
    .font('Helvetica')
    .text(env.business.address, { align: 'center' });
  if (env.business.phone) doc.text(`Phone: ${env.business.phone}`, { align: 'center' });
  if (env.business.gstin) doc.text(`GSTIN: ${env.business.gstin}`, { align: 'center' });

  doc.moveDown(0.5);
  doc.strokeColor('#0f766e').lineWidth(1.5).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
  doc.moveDown(0.7);

  doc.fillColor('#0f172a').fontSize(14).font('Helvetica-Bold').text('TAX INVOICE', { align: 'center' });
  doc.moveDown(0.5);

  // ---- Invoice meta ----
  const metaTop = doc.y;
  doc.fontSize(10).font('Helvetica-Bold').text('Invoice No:', 40, metaTop, { continued: true }).font('Helvetica').text(` ${invoice.invoiceNumber}`);
  doc.font('Helvetica-Bold').text('Date/Time:', 40, doc.y, { continued: true }).font('Helvetica').text(` ${invoice.saleDate.toLocaleString('en-IN')}`);
  doc.font('Helvetica-Bold').text('Billed By:', 40, doc.y, { continued: true }).font('Helvetica').text(` ${invoice.createdByName}`);

  doc.font('Helvetica-Bold').text('Customer:', 320, metaTop, { continued: true }).font('Helvetica').text(` ${invoice.customerName}`);
  if (invoice.customerPhone) {
    doc.font('Helvetica-Bold').text('Phone:', 320, doc.y, { continued: true }).font('Helvetica').text(` ${invoice.customerPhone}`);
  }
  doc.font('Helvetica-Bold').text('Payment:', 320, doc.y, { continued: true }).font('Helvetica').text(` ${invoice.paymentMethod} (${invoice.paymentStatus})`);

  doc.moveDown(1.2);

  // ---- Items table ----
  const tableTop = doc.y;
  const colX = { sn: 40, name: 65, batch: 220, qty: 275, mrp: 310, price: 355, disc: 400, gst: 440, total: 480 };
  doc.fontSize(9).font('Helvetica-Bold').fillColor('#ffffff');
  doc.rect(40, tableTop, 515, 20).fill('#0f766e');
  doc.fillColor('#ffffff');
  doc.text('#', colX.sn, tableTop + 6, { width: 20 });
  doc.text('Medicine', colX.name, tableTop + 6, { width: 150 });
  doc.text('Batch', colX.batch, tableTop + 6, { width: 50 });
  doc.text('Qty', colX.qty, tableTop + 6, { width: 30 });
  doc.text('MRP', colX.mrp, tableTop + 6, { width: 40 });
  doc.text('Price', colX.price, tableTop + 6, { width: 40 });
  doc.text('Disc%', colX.disc, tableTop + 6, { width: 35 });
  doc.text('GST%', colX.gst, tableTop + 6, { width: 35 });
  doc.text('Total', colX.total, tableTop + 6, { width: 70 });

  let y = tableTop + 22;
  doc.font('Helvetica').fillColor('#0f172a');
  invoice.items.forEach((item, idx) => {
    if (y > 750) {
      doc.addPage();
      y = 40;
    }
    if (idx % 2 === 0) {
      doc.rect(40, y - 2, 515, 18).fill('#f1f5f9');
      doc.fillColor('#0f172a');
    }
    doc.fontSize(8.5);
    doc.text(String(idx + 1), colX.sn, y, { width: 20 });
    doc.text(item.medicineName, colX.name, y, { width: 150 });
    doc.text(item.batchNumber, colX.batch, y, { width: 50 });
    doc.text(String(item.quantity), colX.qty, y, { width: 30 });
    doc.text(item.mrp.toFixed(2), colX.mrp, y, { width: 40 });
    doc.text(item.sellingPrice.toFixed(2), colX.price, y, { width: 40 });
    doc.text(item.discountPercent.toFixed(1), colX.disc, y, { width: 35 });
    doc.text(item.gstPercent.toFixed(1), colX.gst, y, { width: 35 });
    doc.text(item.lineTotal.toFixed(2), colX.total, y, { width: 70 });
    y += 18;
  });

  doc.moveTo(40, y + 2).lineTo(555, y + 2).strokeColor('#cbd5e1').stroke();
  y += 12;

  // ---- Totals ----
  const totalsX = 380;
  doc.fontSize(10).font('Helvetica').fillColor('#0f172a');
  doc.text('Subtotal:', totalsX, y, { width: 100 });
  doc.text(inr(invoice.subTotal), totalsX + 100, y, { width: 75, align: 'right' });
  y += 16;
  doc.text('Discount:', totalsX, y, { width: 100 });
  doc.text(`- ${inr(invoice.discountAmount)}`, totalsX + 100, y, { width: 75, align: 'right' });
  y += 16;
  doc.text('GST:', totalsX, y, { width: 100 });
  doc.text(inr(invoice.gstAmount), totalsX + 100, y, { width: 75, align: 'right' });
  y += 16;
  doc.font('Helvetica-Bold').fontSize(12);
  doc.text('Grand Total:', totalsX, y, { width: 100 });
  doc.text(inr(invoice.totalAmount), totalsX + 100, y, { width: 75, align: 'right' });
  y += 18;
  doc.font('Helvetica').fontSize(10);
  doc.text('Paid Amount:', totalsX, y, { width: 100 });
  doc.text(inr(invoice.paidAmount), totalsX + 100, y, { width: 75, align: 'right' });
  const balance = invoice.totalAmount - invoice.paidAmount;
  if (balance > 0.009) {
    y += 16;
    doc.fillColor('#b91c1c').font('Helvetica-Bold');
    doc.text('Balance Due:', totalsX, y, { width: 100 });
    doc.text(inr(balance), totalsX + 100, y, { width: 75, align: 'right' });
    doc.fillColor('#0f172a').font('Helvetica');
  }

  y += 40;
  doc.fontSize(8).fillColor('#64748b').text(
    'This is a computer-generated invoice from AR Medical billing & inventory system. Medicines once sold are exchangeable/returnable only per store policy.',
    40,
    y,
    { width: 515, align: 'center' }
  );
  y += 22;
  doc.fontSize(9).fillColor('#0f172a').text(`${env.business.name} — ${env.business.address}`, 40, y, { width: 515, align: 'center' });

  doc.end();
}

export interface TableColumn {
  header: string;
  key: string;
  width: number;
  align?: 'left' | 'right' | 'center';
}

export function streamTablePdf(
  res: Response,
  filename: string,
  title: string,
  columns: TableColumn[],
  rows: Record<string, unknown>[],
  subtitle?: string
) {
  const doc = new PDFDocument({ size: 'A4', margin: 30, layout: 'landscape' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=${filename}.pdf`);
  doc.pipe(res);

  doc.fillColor('#0f766e').fontSize(18).font('Helvetica-Bold').text(env.business.name, { align: 'center' });
  doc.fillColor('#334155').fontSize(9).font('Helvetica').text(env.business.address, { align: 'center' });
  doc.moveDown(0.3);
  doc.fillColor('#0f172a').fontSize(13).font('Helvetica-Bold').text(title, { align: 'center' });
  if (subtitle) {
    doc.fontSize(9).font('Helvetica').fillColor('#475569').text(subtitle, { align: 'center' });
  }
  doc.moveDown(0.6);

  const startX = 30;
  let y = doc.y;
  const rowHeight = 18;

  const drawHeader = () => {
    doc.rect(startX, y, columns.reduce((s, c) => s + c.width, 0), rowHeight).fill('#0f766e');
    let x = startX;
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#ffffff');
    columns.forEach((c) => {
      doc.text(c.header, x + 4, y + 5, { width: c.width - 8, align: c.align ?? 'left' });
      x += c.width;
    });
    y += rowHeight;
  };

  drawHeader();
  doc.font('Helvetica').fontSize(8);
  rows.forEach((row, idx) => {
    if (y > 550) {
      doc.addPage();
      y = 30;
      drawHeader();
      doc.font('Helvetica').fontSize(8);
    }
    if (idx % 2 === 0) {
      doc.rect(startX, y, columns.reduce((s, c) => s + c.width, 0), rowHeight).fill('#f1f5f9');
    }
    doc.fillColor('#0f172a');
    let x = startX;
    columns.forEach((c) => {
      const val = row[c.key];
      doc.text(val === null || val === undefined ? '' : String(val), x + 4, y + 5, { width: c.width - 8, align: c.align ?? 'left' });
      x += c.width;
    });
    y += rowHeight;
  });

  doc.end();
}
