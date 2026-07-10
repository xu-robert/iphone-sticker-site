import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

const CartContext = createContext(null);
const STORAGE_KEY = 'sticker_cart';

function loadCart() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch { return []; }
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(loadCart);
  const [pricing, setPricing] = useState(null);

  useEffect(() => {
    fetch('/api/pricing').then(r => r.json()).then(setPricing).catch(() => {});
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = useCallback((imageUrl, displayUrl, sizeValue, quantity) => {
    if (!pricing) return;
    const size = pricing.sizes.find(s => s.value === sizeValue);
    if (!size) return;
    const id = crypto.randomUUID();
    setItems(prev => [...prev, {
      id, imageUrl, displayUrl,
      sizeValue: size.value, sizeLabel: size.label,
      quantity, unitPriceCents: size.priceCents,
    }]);
  }, [pricing]);

  const removeItem = useCallback((id) => {
    setItems(prev => prev.filter(i => i.id !== id));
  }, []);

  const updateItemQuantity = useCallback((id, quantity) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, quantity: Math.max(1, quantity) } : i));
  }, []);

  const updateItemSize = useCallback((id, sizeValue) => {
    if (!pricing) return;
    const size = pricing.sizes.find(s => s.value === sizeValue);
    if (!size) return;
    setItems(prev => prev.map(i => i.id === id ? {
      ...i, sizeValue: size.value, sizeLabel: size.label, unitPriceCents: size.priceCents,
    } : i));
  }, [pricing]);

  const clearCart = useCallback(() => setItems([]), []);

  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotalCents = items.reduce((sum, i) => sum + i.unitPriceCents * i.quantity, 0);

  const value = useMemo(() => ({
    items, pricing, addItem, removeItem, updateItemQuantity, updateItemSize, clearCart,
    itemCount, subtotalCents,
  }), [items, pricing, addItem, removeItem, updateItemQuantity, updateItemSize, clearCart, itemCount, subtotalCents]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  return useContext(CartContext);
}
