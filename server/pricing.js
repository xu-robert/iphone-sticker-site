export const SIZES = [
  { value: '2in', label: '2 inch', inches: 2, priceCents: 300 },
  { value: '3in', label: '3 inch', inches: 3, priceCents: 450 },
  { value: '4in', label: '4 inch', inches: 4, priceCents: 600 },
  { value: '5in', label: '5 inch', inches: 5, priceCents: 800 },
];

export const SHIPPING_FLAT_CENTS = 399;

export const TAX_RATES = {
  AB: { rate: 0.05, label: 'GST' },
  BC: { rate: 0.12, label: 'GST + PST' },
  MB: { rate: 0.12, label: 'GST + RST' },
  NB: { rate: 0.15, label: 'HST' },
  NL: { rate: 0.15, label: 'HST' },
  NS: { rate: 0.15, label: 'HST' },
  NT: { rate: 0.05, label: 'GST' },
  NU: { rate: 0.05, label: 'GST' },
  ON: { rate: 0.13, label: 'HST' },
  PE: { rate: 0.15, label: 'HST' },
  QC: { rate: 0.14975, label: 'GST + QST' },
  SK: { rate: 0.11, label: 'GST + PST' },
  YT: { rate: 0.05, label: 'GST' },
};

export function getTaxRate(provinceCode, country) {
  if ((country || 'CA').toUpperCase() !== 'CA') return null;
  const code = (provinceCode || '').toUpperCase().trim();
  return TAX_RATES[code] || null;
}

export function getSize(value) {
  return SIZES.find(s => s.value === value) || null;
}
