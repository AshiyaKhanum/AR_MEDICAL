import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Search, Trash2, ScanLine, ShoppingCart, UserPlus } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { useMedicineByCode, useMedicines } from '../hooks/useMedicines';
import { useCreateSale } from '../hooks/useSales';
import { useCustomers, useCreateCustomer } from '../hooks/useCustomers';
import { apiErrorMessage } from '../api/client';
import { formatCurrency } from '../utils/format';
import type { Batch, Customer, Medicine } from '../types/models';

interface CartLine {
  key: string;
  medicine: Medicine;
  batch: Batch;
  quantity: number;
  discountPercent: number;
}

function computeLine(batch: Batch, quantity: number, discountPercent: number) {
  const baseAmount = Number(batch.sellingPrice) * quantity;
  const discountAmount = (baseAmount * discountPercent) / 100;
  const taxable = baseAmount - discountAmount;
  const gstAmount = (taxable * Number(batch.gstPercent)) / 100;
  const lineTotal = taxable + gstAmount;
  return { baseAmount, discountAmount, gstAmount, lineTotal };
}

export default function PosPage() {
  const navigate = useNavigate();
  const [scanValue, setScanValue] = useState('');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [overallDiscount, setOverallDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'UPI' | 'BANK_TRANSFER' | 'CREDIT'>('CASH');
  const [customerId, setCustomerId] = useState('');
  const [walkInName, setWalkInName] = useState('Walk-in Customer');
  const [walkInPhone, setWalkInPhone] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const scanRef = useRef<HTMLInputElement>(null);

  const { data: byCode } = useMedicineByCode(scanValue, scanValue.length >= 4);
  const { data: searchResults } = useMedicines({ search, status: 'active' });
  const { data: customers } = useCustomers(customerSearch);
  const createCustomer = useCreateCustomer();
  const createSale = useCreateSale();

  useEffect(() => {
    scanRef.current?.focus();
  }, []);

  function addToCart(medicine: Medicine, batch: Batch) {
    if (batch.quantity <= 0) {
      toast.error('This batch is out of stock');
      return;
    }
    setCart((prev) => {
      const key = `${medicine.id}-${batch.id}`;
      const existing = prev.find((l) => l.key === key);
      if (existing) {
        if (existing.quantity + 1 > batch.quantity) {
          toast.error('Not enough stock in this batch');
          return prev;
        }
        return prev.map((l) => (l.key === key ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...prev, { key, medicine, batch, quantity: 1, discountPercent: 0 }];
    });
  }

  function handleScanSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!scanValue.trim()) return;
    if (byCode) {
      const batch = (byCode.batches ?? [])[0];
      if (!batch) {
        toast.error('No available stock batch for this medicine');
      } else {
        addToCart(byCode, batch);
        toast.success(`${byCode.name} added`);
      }
    } else {
      toast.error('No medicine found for this barcode/SKU');
    }
    setScanValue('');
  }

  function updateLine(key: string, patch: Partial<CartLine>) {
    setCart((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function removeLine(key: string) {
    setCart((prev) => prev.filter((l) => l.key !== key));
  }

  const totals = useMemo(() => {
    let subTotal = 0, discountAmount = 0, gstAmount = 0;
    cart.forEach((l) => {
      const c = computeLine(l.batch, l.quantity, l.discountPercent);
      subTotal += c.baseAmount;
      discountAmount += c.discountAmount;
      gstAmount += c.gstAmount;
    });
    discountAmount += overallDiscount;
    const totalAmount = Math.max(0, subTotal - discountAmount + gstAmount);
    return { subTotal, discountAmount, gstAmount, totalAmount };
  }, [cart, overallDiscount]);

  function handleCheckout() {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }
    if (!customerId && !walkInName.trim()) {
      toast.error('Provide a customer or walk-in name');
      return;
    }
    const payload = {
      customerId: customerId || null,
      walkInCustomerName: customerId ? null : walkInName,
      walkInCustomerPhone: customerId ? null : walkInPhone,
      paymentMethod,
      paidAmount: paymentMethod === 'CREDIT' ? 0 : totals.totalAmount,
      discountAmount: overallDiscount,
      items: cart.map((l) => ({ medicineId: l.medicine.id, batchId: l.batch.id, quantity: l.quantity, discountPercent: l.discountPercent })),
    };
    createSale.mutate(payload, {
      onSuccess: (sale) => {
        toast.success(`Invoice ${sale.invoiceNumber} created`);
        setCart([]);
        setOverallDiscount(0);
        navigate(`/invoices/${sale.id}`);
      },
      onError: (err) => toast.error(apiErrorMessage(err)),
    });
  }

  return (
    <div>
      <PageHeader title="Billing / POS" subtitle="Search or scan medicines to build the bill" />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <form onSubmit={handleScanSubmit} className="card flex items-center gap-2 p-3">
            <ScanLine className="h-5 w-5 text-brand-700 shrink-0" />
            <input
              ref={scanRef}
              className="input"
              placeholder="Scan barcode or type SKU, then press Enter"
              value={scanValue}
              onChange={(e) => setScanValue(e.target.value)}
            />
            <button type="submit" className="btn-primary shrink-0">Add</button>
          </form>

          <div className="card p-3">
            <div className="relative mb-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input className="input pl-9" placeholder="Search medicine by name…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            {search && (
              <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-100">
                {(searchResults ?? []).slice(0, 8).map((m) => (
                  <button
                    key={m.id}
                    className="flex w-full items-center justify-between border-b border-slate-50 px-3 py-2 text-left text-sm last:border-0 hover:bg-slate-50 disabled:opacity-40"
                    disabled={(m.totalStock ?? 0) === 0}
                    onClick={() => {
                      const batch = (m.batches ?? []).filter((b) => b.quantity > 0).sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime())[0];
                      if (batch) addToCart(m, batch);
                    }}
                  >
                    <span>
                      {m.name} <span className="text-xs text-slate-400">({m.genericName})</span>
                      {m.rackNumber && <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-600">Rack {m.rackNumber}</span>}
                    </span>
                    <span className={(m.totalStock ?? 0) === 0 ? 'text-xs text-red-500' : 'text-xs text-slate-500'}>{m.totalStock ?? 0} {m.unit}</span>
                  </button>
                ))}
                {(searchResults ?? []).length === 0 && <p className="p-3 text-sm text-slate-400">No matches</p>}
              </div>
            )}
          </div>

          <div className="card overflow-hidden">
            <div className="border-b border-slate-100 px-4 py-3 flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-700">Cart ({cart.length})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr><th>Medicine</th><th>Batch</th><th>Qty</th><th>Price</th><th>Disc%</th><th>GST%</th><th>Total</th><th></th></tr>
                </thead>
                <tbody>
                  {cart.map((l) => {
                    const c = computeLine(l.batch, l.quantity, l.discountPercent);
                    return (
                      <tr key={l.key}>
                        <td>{l.medicine.name}</td>
                        <td className="font-mono text-xs">{l.batch.batchNumber}</td>
                        <td>
                          <input
                            type="number"
                            min={1}
                            max={l.batch.quantity}
                            className="input !w-20 !py-1"
                            value={l.quantity}
                            onChange={(e) => {
                              const q = Math.max(1, Math.min(l.batch.quantity, Number(e.target.value) || 1));
                              updateLine(l.key, { quantity: q });
                            }}
                          />
                        </td>
                        <td>{formatCurrency(l.batch.sellingPrice)}</td>
                        <td>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            className="input !w-20 !py-1"
                            value={l.discountPercent}
                            onChange={(e) => updateLine(l.key, { discountPercent: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                          />
                        </td>
                        <td>{Number(l.batch.gstPercent)}%</td>
                        <td className="font-medium">{formatCurrency(c.lineTotal)}</td>
                        <td>
                          <button onClick={() => removeLine(l.key)} className="text-red-500 hover:text-red-700">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {cart.length === 0 && <tr><td colSpan={8} className="py-10 text-center text-slate-400">Cart is empty — scan or search a medicine to begin</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-4 space-y-3">
            <h2 className="text-sm font-semibold text-slate-700">Customer</h2>
            {!showNewCustomer ? (
              <>
                <input
                  className="input"
                  placeholder="Search customer by name/phone…"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                />
                <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                  <option value="">— Walk-in customer —</option>
                  {(customers ?? []).map((c: Customer) => <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</option>)}
                </select>
                {!customerId && (
                  <div className="grid grid-cols-2 gap-2">
                    <input className="input" placeholder="Walk-in name" value={walkInName} onChange={(e) => setWalkInName(e.target.value)} />
                    <input className="input" placeholder="Phone (optional)" value={walkInPhone} onChange={(e) => setWalkInPhone(e.target.value)} />
                  </div>
                )}
                <button type="button" className="flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline" onClick={() => setShowNewCustomer(true)}>
                  <UserPlus className="h-3.5 w-3.5" /> Register new customer
                </button>
              </>
            ) : (
              <NewCustomerForm
                onCancel={() => setShowNewCustomer(false)}
                onCreated={(c) => {
                  setCustomerId(c.id);
                  setShowNewCustomer(false);
                }}
                createCustomer={createCustomer}
              />
            )}
          </div>

          <div className="card p-4 space-y-3">
            <h2 className="text-sm font-semibold text-slate-700">Payment</h2>
            <select className="input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as any)}>
              <option value="CASH">Cash</option>
              <option value="CARD">Card</option>
              <option value="UPI">UPI</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="CREDIT">Credit (Pay Later)</option>
            </select>
            <div>
              <label className="label">Overall Discount (₹)</label>
              <input type="number" min={0} className="input" value={overallDiscount} onChange={(e) => setOverallDiscount(Math.max(0, Number(e.target.value) || 0))} />
            </div>
          </div>

          <div className="card p-4 space-y-2">
            <div className="flex justify-between text-sm"><span className="text-slate-500">Subtotal</span><span>{formatCurrency(totals.subTotal)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-500">Discount</span><span>- {formatCurrency(totals.discountAmount)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-500">GST</span><span>{formatCurrency(totals.gstAmount)}</span></div>
            <div className="flex justify-between border-t border-slate-100 pt-2 text-base font-bold"><span>Grand Total</span><span>{formatCurrency(totals.totalAmount)}</span></div>
            <button className="btn-primary mt-2 w-full" onClick={handleCheckout} disabled={createSale.isPending || cart.length === 0}>
              {createSale.isPending ? 'Processing…' : 'Complete Sale & Generate Invoice'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function NewCustomerForm({
  onCancel,
  onCreated,
  createCustomer,
}: {
  onCancel: () => void;
  onCreated: (c: Customer) => void;
  createCustomer: ReturnType<typeof useCreateCustomer>;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  return (
    <div className="space-y-2">
      <input className="input" placeholder="Customer name" value={name} onChange={(e) => setName(e.target.value)} />
      <input className="input" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <div className="flex gap-2">
        <button className="btn-secondary flex-1" onClick={onCancel}>Cancel</button>
        <button
          className="btn-primary flex-1"
          disabled={!name.trim() || createCustomer.isPending}
          onClick={() =>
            createCustomer.mutate(
              { name, phone },
              {
                onSuccess: (c) => {
                  toast.success('Customer registered');
                  onCreated(c);
                },
                onError: (err) => toast.error(apiErrorMessage(err)),
              }
            )
          }
        >
          Save
        </button>
      </div>
    </div>
  );
}
