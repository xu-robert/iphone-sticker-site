export const SIZES = [
  { value: '2in', label: '2 inch', inches: 2, priceCents: 300 },
  { value: '3in', label: '3 inch', inches: 3, priceCents: 450 },
  { value: '4in', label: '4 inch', inches: 4, priceCents: 600 },
  { value: '5in', label: '5 inch', inches: 5, priceCents: 800 },
];

export const SHIPPING_FLAT_CENTS = 399;

export function getSize(value) {
  return SIZES.find(s => s.value === value) || null;
}
