// Central business identity for AR Medical — used across header, login, sidebar,
// invoices, print/PDF output, reports and footer so it never drifts.
export const BUSINESS = {
  name: import.meta.env.VITE_BUSINESS_NAME || 'AR Medical',
  address: import.meta.env.VITE_BUSINESS_ADDRESS || 'Wadi e Huda, Shimoga 572100',
  tagline: 'Medical Billing & Inventory Management System',
};
