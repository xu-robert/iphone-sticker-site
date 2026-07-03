import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import DesktopPage from './pages/DesktopPage.jsx';
import PhonePage from './pages/PhonePage.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DesktopPage />} />
        <Route path="/phone/:sessionId" element={<PhonePage />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
