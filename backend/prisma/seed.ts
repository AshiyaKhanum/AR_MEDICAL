/* eslint-disable no-console */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

async function nextSeq(key: string, prefix: string): Promise<string> {
  const year = new Date().getFullYear();
  const id = `${key}-${year}`;
  const counter = await prisma.counter.upsert({ where: { id }, update: { value: { increment: 1 } }, create: { id, value: 1 } });
  return `${prefix}-${year}-${String(counter.value).padStart(6, '0')}`;
}

async function main() {
  console.log('Seeding AR Medical database...');

  // ---------------- Users ----------------
  const passwordHash = await bcrypt.hash('Admin@123', 10);
  const pharmacistHash = await bcrypt.hash('Pharma@123', 10);
  const staffHash = await bcrypt.hash('Staff@123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@armedical.in' },
    update: {},
    create: { name: 'Ashiya Khanum', email: 'admin@armedical.in', phone: '9900000001', role: 'ADMIN', passwordHash },
  });

  const pharmacist = await prisma.user.upsert({
    where: { email: 'pharmacist@armedical.in' },
    update: {},
    create: { name: 'Ramesh Rao', email: 'pharmacist@armedical.in', phone: '9900000002', role: 'PHARMACIST', passwordHash: pharmacistHash },
  });

  const staff = await prisma.user.upsert({
    where: { email: 'staff@armedical.in' },
    update: {},
    create: { name: 'Sunita Devi', email: 'staff@armedical.in', phone: '9900000003', role: 'STAFF', passwordHash: staffHash },
  });

  // ---------------- Categories / Manufacturers ----------------
  const categoryNames = ['Analgesic', 'Antibiotic', 'Antacid', 'Antihistamine', 'Vitamin & Supplement', 'Antiseptic', 'Diabetes Care', 'Cardiac Care'];
  const categories = await Promise.all(
    categoryNames.map((name) => prisma.category.upsert({ where: { name }, update: {}, create: { name } }))
  );

  const manufacturerNames = ['Cipla Ltd', 'Sun Pharma', 'Dr. Reddy\'s Labs', 'Mankind Pharma', 'Zydus Lifesciences', 'Abbott India'];
  const manufacturers = await Promise.all(
    manufacturerNames.map((name) => prisma.manufacturer.upsert({ where: { name }, update: {}, create: { name } }))
  );

  // ---------------- Suppliers ----------------
  const supplierData = [
    { name: 'Shivamogga Pharma Distributors', contactPerson: 'Manoj Gowda', phone: '9448100001', email: 'manoj@shimogapharma.in', address: 'B.H. Road, Shimoga', gstin: '29ABCDE1111F1Z1' },
    { name: 'Karnataka Drug House', contactPerson: 'Lakshmi Narayan', phone: '9448100002', email: 'sales@kdh.in', address: 'Gandhi Bazaar, Shimoga', gstin: '29ABCDE2222F1Z2' },
    { name: 'Malnad Medical Agencies', contactPerson: 'Prakash Hegde', phone: '9448100003', email: 'prakash@malnadmed.in', address: 'Vinoba Nagar, Shimoga', gstin: '29ABCDE3333F1Z3' },
  ];
  const suppliers = [];
  for (const s of supplierData) {
    const existing = await prisma.supplier.findFirst({ where: { name: s.name } });
    suppliers.push(existing ?? (await prisma.supplier.create({ data: s })));
  }

  // ---------------- Customers ----------------
  const customerData = [
    { name: 'Walk-in Customer', phone: null, email: null, address: null },
    { name: 'Anita Shetty', phone: '9880011001', email: 'anita.shetty@example.com', address: 'Gopala Extension, Shimoga' },
    { name: 'Manjunath Rao', phone: '9880011002', email: null, address: 'Vidyanagar, Shimoga' },
    { name: 'Fathima Begum', phone: '9880011003', email: null, address: 'Wadi e Huda, Shimoga' },
  ];
  const customers = [];
  for (const c of customerData) {
    const existing = await prisma.customer.findFirst({ where: { name: c.name } });
    customers.push(existing ?? (await prisma.customer.create({ data: c })));
  }

  // ---------------- Medicines + Batches ----------------
  type MedSpec = {
    name: string; genericName: string; category: string; manufacturer: string; unit: string;
    gstPercent: number; minStockLevel: number; sku: string; barcode: string;
    purchasePrice: number; sellingPrice: number; mrp: number; qty: number; expiryDays: number;
  };

  const medSpecs: MedSpec[] = [
    { name: 'Paracetamol 500mg', genericName: 'Paracetamol', category: 'Analgesic', manufacturer: 'Cipla Ltd', unit: 'STRIP', gstPercent: 12, minStockLevel: 50, sku: 'MED-0001', barcode: '8901000000011', purchasePrice: 12, sellingPrice: 18, mrp: 20, qty: 400, expiryDays: 540 },
    { name: 'Azithromycin 500mg', genericName: 'Azithromycin', category: 'Antibiotic', manufacturer: 'Sun Pharma', unit: 'STRIP', gstPercent: 12, minStockLevel: 20, sku: 'MED-0002', barcode: '8901000000028', purchasePrice: 55, sellingPrice: 78, mrp: 85, qty: 120, expiryDays: 400 },
    { name: 'Amoxicillin 250mg', genericName: 'Amoxicillin', category: 'Antibiotic', manufacturer: "Dr. Reddy's Labs", unit: 'STRIP', gstPercent: 12, minStockLevel: 30, sku: 'MED-0003', barcode: '8901000000035', purchasePrice: 30, sellingPrice: 45, mrp: 50, qty: 8, expiryDays: 25 },
    { name: 'Pantoprazole 40mg', genericName: 'Pantoprazole', category: 'Antacid', manufacturer: 'Mankind Pharma', unit: 'STRIP', gstPercent: 12, minStockLevel: 25, sku: 'MED-0004', barcode: '8901000000042', purchasePrice: 40, sellingPrice: 60, mrp: 65, qty: 150, expiryDays: 300 },
    { name: 'Cetirizine 10mg', genericName: 'Cetirizine', category: 'Antihistamine', manufacturer: 'Zydus Lifesciences', unit: 'STRIP', gstPercent: 5, minStockLevel: 40, sku: 'MED-0005', barcode: '8901000000059', purchasePrice: 8, sellingPrice: 14, mrp: 15, qty: 0, expiryDays: 200 },
    { name: 'Vitamin C 500mg Tablets', genericName: 'Ascorbic Acid', category: 'Vitamin & Supplement', manufacturer: 'Abbott India', unit: 'BOTTLE', gstPercent: 18, minStockLevel: 15, sku: 'MED-0006', barcode: '8901000000066', purchasePrice: 65, sellingPrice: 95, mrp: 110, qty: 60, expiryDays: 450 },
    { name: 'Metformin 500mg', genericName: 'Metformin', category: 'Diabetes Care', manufacturer: 'Sun Pharma', unit: 'STRIP', gstPercent: 12, minStockLevel: 30, sku: 'MED-0007', barcode: '8901000000073', purchasePrice: 20, sellingPrice: 32, mrp: 35, qty: 200, expiryDays: 500 },
    { name: 'Atorvastatin 10mg', genericName: 'Atorvastatin', category: 'Cardiac Care', manufacturer: 'Cipla Ltd', unit: 'STRIP', gstPercent: 12, minStockLevel: 20, sku: 'MED-0008', barcode: '8901000000080', purchasePrice: 35, sellingPrice: 52, mrp: 58, qty: 90, expiryDays: 60 },
    { name: 'Povidone Iodine Solution', genericName: 'Povidone Iodine', category: 'Antiseptic', manufacturer: 'Mankind Pharma', unit: 'BOTTLE', gstPercent: 18, minStockLevel: 10, sku: 'MED-0009', barcode: '8901000000097', purchasePrice: 28, sellingPrice: 42, mrp: 48, qty: 45, expiryDays: 600 },
    { name: 'Ibuprofen 400mg', genericName: 'Ibuprofen', category: 'Analgesic', manufacturer: "Dr. Reddy's Labs", unit: 'STRIP', gstPercent: 12, minStockLevel: 40, sku: 'MED-0010', barcode: '8901000000103', purchasePrice: 15, sellingPrice: 22, mrp: 25, qty: 5, expiryDays: 15 },
  ];

  const catMap = new Map(categories.map((c) => [c.name, c.id]));
  const manMap = new Map(manufacturers.map((m) => [m.name, m.id]));

  const medicines = [];
  for (const spec of medSpecs) {
    const medicine = await prisma.medicine.upsert({
      where: { sku: spec.sku },
      update: {},
      create: {
        name: spec.name,
        genericName: spec.genericName,
        categoryId: catMap.get(spec.category),
        manufacturerId: manMap.get(spec.manufacturer),
        sku: spec.sku,
        barcode: spec.barcode,
        gstPercent: spec.gstPercent,
        unit: spec.unit,
        minStockLevel: spec.minStockLevel,
      },
    });
    medicines.push({ medicine, spec });

    const batchNumber = `B${spec.sku.slice(-4)}-01`;
    const existingBatch = await prisma.batch.findUnique({
      where: { medicineId_batchNumber: { medicineId: medicine.id, batchNumber } },
    });
    if (!existingBatch) {
      const batch = await prisma.batch.create({
        data: {
          medicineId: medicine.id,
          batchNumber,
          supplierId: suppliers[Math.floor(Math.random() * suppliers.length)].id,
          purchasePrice: spec.purchasePrice,
          sellingPrice: spec.sellingPrice,
          mrp: spec.mrp,
          gstPercent: spec.gstPercent,
          quantity: spec.qty,
          initialQuantity: spec.qty,
          manufacturingDate: daysAgo(60),
          expiryDate: daysFromNow(spec.expiryDays),
        },
      });
      if (spec.qty > 0) {
        await prisma.stockMovement.create({
          data: { batchId: batch.id, type: 'ADJUSTMENT', quantity: spec.qty, balanceAfter: spec.qty, reference: 'SEED_OPENING_STOCK' },
        });
      }
    }
  }

  console.log(`Seeded ${medicines.length} medicines with opening batches.`);

  // ---------------- Sample purchase (Supplier -> Purchase -> Batch -> Inventory) ----------------
  const existingPurchases = await prisma.purchase.count();
  if (existingPurchases === 0) {
    const supplier = suppliers[0];
    const items = medicines.slice(0, 3);
    const subTotal = items.reduce((s, m) => s + m.spec.purchasePrice * 50, 0);
    const gstAmount = items.reduce((s, m) => s + (m.spec.purchasePrice * 50 * m.spec.gstPercent) / 100, 0);
    const totalAmount = subTotal + gstAmount;
    const purchaseNumber = await nextSeq('PURCHASE', 'PUR');

    const purchase = await prisma.purchase.create({
      data: {
        purchaseNumber,
        supplierId: supplier.id,
        invoiceNumber: 'SUPINV-0001',
        purchaseDate: daysAgo(20),
        subTotal,
        discountAmount: 0,
        gstAmount,
        totalAmount,
        paidAmount: totalAmount,
        paymentStatus: 'PAID',
        notes: 'Initial stocking purchase (seed data)',
        createdById: admin.id,
      },
    });

    for (const m of items) {
      const batch = await prisma.batch.findFirst({ where: { medicineId: m.medicine.id } });
      if (!batch) continue;
      await prisma.purchaseItem.create({
        data: {
          purchaseId: purchase.id,
          medicineId: m.medicine.id,
          batchId: batch.id,
          quantity: 50,
          purchasePrice: m.spec.purchasePrice,
          gstPercent: m.spec.gstPercent,
          lineTotal: m.spec.purchasePrice * 50 * (1 + m.spec.gstPercent / 100),
        },
      });
    }
    console.log(`Seeded sample purchase ${purchaseNumber}.`);
  }

  // ---------------- Sample sales across the last 20 days (for dashboard charts) ----------------
  const existingSales = await prisma.sale.count();
  if (existingSales === 0) {
    const sellableMeds = medicines.filter((m) => m.spec.qty > 20);
    for (let day = 19; day >= 0; day--) {
      const salesToday = 1 + Math.floor(Math.random() * 3);
      for (let s = 0; s < salesToday; s++) {
        const picks = sellableMeds
          .sort(() => 0.5 - Math.random())
          .slice(0, 1 + Math.floor(Math.random() * 3));

        const lineData = [];
        for (const pick of picks) {
          const batch = await prisma.batch.findFirst({ where: { medicineId: pick.medicine.id, quantity: { gt: 5 } } });
          if (!batch) continue;
          const qty = 1 + Math.floor(Math.random() * 4);
          if (batch.quantity < qty) continue;
          const discountPercent = Math.random() < 0.2 ? 5 : 0;
          const baseAmount = Number(batch.sellingPrice) * qty;
          const discountAmount = (baseAmount * discountPercent) / 100;
          const taxable = baseAmount - discountAmount;
          const gstAmount = (taxable * Number(batch.gstPercent)) / 100;
          const lineTotal = taxable + gstAmount;
          lineData.push({ pick, batch, qty, discountPercent, baseAmount, discountAmount, gstAmount, lineTotal });
        }
        if (lineData.length === 0) continue;

        const subTotal = lineData.reduce((sum, l) => sum + l.baseAmount, 0);
        const discountAmount = lineData.reduce((sum, l) => sum + l.discountAmount, 0);
        const gstAmount = lineData.reduce((sum, l) => sum + l.gstAmount, 0);
        const totalAmount = subTotal - discountAmount + gstAmount;
        const saleDate = daysAgo(day);
        const invoiceNumber = await nextSeq('SALE', 'INV');
        const customer = customers[Math.floor(Math.random() * customers.length)];
        const method = ['CASH', 'CARD', 'UPI', 'CASH', 'CASH'][Math.floor(Math.random() * 5)] as any;

        const sale = await prisma.sale.create({
          data: {
            invoiceNumber,
            customerId: customer.name === 'Walk-in Customer' ? null : customer.id,
            walkInCustomerName: customer.name === 'Walk-in Customer' ? 'Walk-in Customer' : null,
            saleDate,
            subTotal,
            discountAmount,
            gstAmount,
            totalAmount,
            paidAmount: totalAmount,
            paymentMethod: method,
            paymentStatus: 'PAID',
            createdById: [admin.id, pharmacist.id, staff.id][Math.floor(Math.random() * 3)],
          },
        });

        for (const l of lineData) {
          await prisma.saleItem.create({
            data: {
              saleId: sale.id,
              medicineId: l.pick.medicine.id,
              batchId: l.batch.id,
              quantity: l.qty,
              mrp: l.batch.mrp,
              sellingPrice: l.batch.sellingPrice,
              discountPercent: l.discountPercent,
              gstPercent: l.batch.gstPercent,
              lineTotal: l.lineTotal,
            },
          });
          const updatedBatch = await prisma.batch.update({
            where: { id: l.batch.id },
            data: { quantity: { decrement: l.qty } },
          });
          await prisma.stockMovement.create({
            data: {
              batchId: l.batch.id,
              type: 'SALE_OUT',
              quantity: -l.qty,
              balanceAfter: updatedBatch.quantity,
              reference: invoiceNumber,
            },
          });
        }

        await prisma.payment.create({
          data: { saleId: sale.id, amount: totalAmount, method, status: 'PAID', reference: invoiceNumber, paidAt: saleDate },
        });
      }
    }
    console.log('Seeded 20 days of sample sales for dashboard charts.');
  }

  console.log('\nDemo login credentials:');
  console.log('  Admin:       admin@armedical.in / Admin@123');
  console.log('  Pharmacist:  pharmacist@armedical.in / Pharma@123');
  console.log('  Staff:       staff@armedical.in / Staff@123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
