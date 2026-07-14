import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { CartProvider } from './context/CartContext.jsx';
import DesktopPage from './pages/DesktopPage.jsx';
import PhonePage from './pages/PhonePage.jsx';
import CartPage from './pages/CartPage.jsx';
import OrderConfirmationPage from './pages/OrderConfirmationPage.jsx';
import OrderLookupPage from './pages/OrderLookupPage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <CartProvider>
        <Routes>
          <Route path="/" element={<DesktopPage />} />
          <Route path="/phone/:sessionId" element={<PhonePage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/order/:reference" element={<OrderConfirmationPage />} />
          <Route path="/order-lookup" element={<OrderLookupPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </CartProvider>
    </BrowserRouter>
  </StrictMode>,
);
