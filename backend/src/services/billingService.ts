export interface BillableItem {
  sellingPrice: number;
  mrp: number;
  quantity: number;
  discountPercent: number;
  gstPercent: number;
}

export interface ComputedLine extends BillableItem {
  baseAmount: number;
  discountAmount: number;
  taxableAmount: number;
  gstAmount: number;
  lineTotal: number;
}

export function computeLine(item: BillableItem): ComputedLine {
  const baseAmount = round2(item.sellingPrice * item.quantity);
  const discountAmount = round2((baseAmount * item.discountPercent) / 100);
  const taxableAmount = round2(baseAmount - discountAmount);
  const gstAmount = round2((taxableAmount * item.gstPercent) / 100);
  const lineTotal = round2(taxableAmount + gstAmount);
  return { ...item, baseAmount, discountAmount, taxableAmount, gstAmount, lineTotal };
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function computeBillTotals(lines: ComputedLine[], overallDiscount = 0) {
  const subTotal = round2(lines.reduce((s, l) => s + l.baseAmount, 0));
  const itemDiscountTotal = round2(lines.reduce((s, l) => s + l.discountAmount, 0));
  const gstAmount = round2(lines.reduce((s, l) => s + l.gstAmount, 0));
  const discountAmount = round2(itemDiscountTotal + overallDiscount);
  const totalAmount = round2(subTotal - discountAmount + gstAmount);
  return { subTotal, discountAmount, gstAmount, totalAmount };
}
