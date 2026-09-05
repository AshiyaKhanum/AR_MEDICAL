import { useParams, Link } from 'react-router-dom';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowLeft, Printer, Download, IndianRupee } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import { useSale, useSalePayment } from '../hooks/useSales';
import { apiClient, apiErrorMessage } from '../api/client';
import { BUSINESS } from '../config/business';
import { formatCurrency, formatDateTime } from '../utils/format';
import { usePermissions } from '../hooks/useAuth';

export default function InvoicePage() {
  const { id } = useParams<{ id: string }>();
  const { data: sale, isLoading } = useSale(id);
  const [downloading, setDownloading] = useState(false);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState('CASH');
  const salePayment = useSalePayment();
  const { canManageInventory } = usePermissions();

  if (isLoading || !sale) return <div className="text-sm text-slate-500">Loading invoice…</div>;

  const balanceDue = Number(sale.totalAmount) - Number(sale.paidAmount);

  async function downloadPdf() {
    if (!id) return;
    setDownloading(true);
    try {
      const res = await apiClient.get(`/sales/${id}/invoice/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${sale?.invoiceNumber ?? 'invoice'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to download invoice PDF'));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link to="/sales" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-700">
          <ArrowLeft className="h-4 w-4" /> Back to Invoices
        </Link>
        <div className="flex flex-wrap gap-2">
          {balanceDue > 0.01 && canManageInventory && (
            <button className="btn-secondary" onClick={() => { setPayAmount(balanceDue); setPayModalOpen(true); }}>
              <IndianRupee className="h-4 w-4" /> Record Payment
            </button>
          )}
          <button className="btn-secondary" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Print / Reprint
          </button>
          <button className="btn-primary" onClick={downloadPdf} disabled={downloading}>
            <Download className="h-4 w-4" /> {downloading ? 'Preparing…' : 'Download PDF'}
          </button>
        </div>
      </div>

      <div id="print-invoice" className="card mx-auto max-w-3xl p-8 print:border-0 print:shadow-none">
        <div className="text-center border-b border-slate-200 pb-4">
          <h1 className="text-2xl font-extrabold text-brand-800">{BUSINESS.name}</h1>
          <p className="text-sm text-slate-600">{BUSINESS.address}</p>
          <p className="mt-2 text-lg font-semibold tracking-wide text-slate-800">TAX INVOICE</p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p><span className="font-semibold">Invoice No:</span> {sale.invoiceNumber}</p>
            <p><span className="font-semibold">Date/Time:</span> {formatDateTime(sale.saleDate)}</p>
            <p><span className="font-semibold">Billed By:</span> {sale.createdBy?.name}</p>
          </div>
          <div className="sm:text-right">
            <p><span className="font-semibold">Customer:</span> {sale.customer?.name ?? sale.walkInCustomerName ?? 'Walk-in Customer'}</p>
            {(sale.customer?.phone || sale.walkInCustomerPhone) && (
              <p><span className="font-semibold">Phone:</span> {sale.customer?.phone ?? sale.walkInCustomerPhone}</p>
            )}
            <p><span className="font-semibold">Payment:</span> {sale.paymentMethod} (<StatusBadge status={sale.paymentStatus} />)</p>
          </div>
        </div>

        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="bg-brand-700 text-white">
              <th className="px-2 py-2 text-left">#</th>
              <th className="px-2 py-2 text-left">Medicine</th>
              <th className="px-2 py-2 text-left">Batch</th>
              <th className="px-2 py-2 text-right">Qty</th>
              <th className="px-2 py-2 text-right">MRP</th>
              <th className="px-2 py-2 text-right">Price</th>
              <th className="px-2 py-2 text-right">Disc%</th>
              <th className="px-2 py-2 text-right">GST%</th>
              <th className="px-2 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((item, idx) => (
              <tr key={item.id} className={idx % 2 === 0 ? 'bg-slate-50' : ''}>
                <td className="px-2 py-1.5">{idx + 1}</td>
                <td className="px-2 py-1.5">{item.medicine?.name}</td>
                <td className="px-2 py-1.5 font-mono text-xs">{item.batch?.batchNumber}</td>
                <td className="px-2 py-1.5 text-right">{item.quantity}</td>
                <td className="px-2 py-1.5 text-right">{Number(item.mrp).toFixed(2)}</td>
                <td className="px-2 py-1.5 text-right">{Number(item.sellingPrice).toFixed(2)}</td>
                <td className="px-2 py-1.5 text-right">{Number(item.discountPercent).toFixed(1)}</td>
                <td className="px-2 py-1.5 text-right">{Number(item.gstPercent).toFixed(1)}</td>
                <td className="px-2 py-1.5 text-right font-medium">{Number(item.lineTotal).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 flex justify-end">
          <div className="w-64 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span>{formatCurrency(sale.subTotal)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Discount</span><span>- {formatCurrency(sale.discountAmount)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">GST</span><span>{formatCurrency(sale.gstAmount)}</span></div>
            <div className="flex justify-between border-t border-slate-200 pt-1 text-base font-bold"><span>Grand Total</span><span>{formatCurrency(sale.totalAmount)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Paid</span><span>{formatCurrency(sale.paidAmount)}</span></div>
            {balanceDue > 0.01 && (
              <div className="flex justify-between font-semibold text-red-600"><span>Balance Due</span><span>{formatCurrency(balanceDue)}</span></div>
            )}
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-slate-400">
          This is a computer-generated invoice from {BUSINESS.name} billing &amp; inventory system.
        </p>
        <p className="mt-1 text-center text-sm font-medium text-slate-700">{BUSINESS.name} — {BUSINESS.address}</p>
      </div>

      <Modal open={payModalOpen} onClose={() => setPayModalOpen(false)} title="Record Payment">
        <div className="space-y-3">
          <div>
            <label className="label">Amount</label>
            <input type="number" step="0.01" className="input" value={payAmount} onChange={(e) => setPayAmount(Number(e.target.value))} />
          </div>
          <div>
            <label className="label">Method</label>
            <select className="input" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
              <option value="CASH">Cash</option>
              <option value="CARD">Card</option>
              <option value="UPI">UPI</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-secondary" onClick={() => setPayModalOpen(false)}>Cancel</button>
            <button
              className="btn-primary"
              disabled={salePayment.isPending || payAmount <= 0}
              onClick={() =>
                salePayment.mutate(
                  { id: sale.id, amount: payAmount, method: payMethod },
                  {
                    onSuccess: () => {
                      toast.success('Payment recorded');
                      setPayModalOpen(false);
                    },
                    onError: (err) => toast.error(apiErrorMessage(err)),
                  }
                )
              }
            >
              Record Payment
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
