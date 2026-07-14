# Changelog

## 2026-07-13
- Order confirmation emails via Resend (sends item breakdown, totals, shipping, reference number)

## 2026-07-09
- Guest checkout e-commerce layer with Stripe Checkout
- SQLite database for orders and line items
- Cart with localStorage persistence, pricing API
- Shipping form, Stripe redirect, webhook for payment confirmation
- Order confirmation page and order lookup by reference + email
- "Order" button on sticker cards, AddToCartModal with size/quantity picker

## 2026-07-07
- Auto background removal using RMBG-1.4 ONNX model (client-side inference)
- Outline tracing performance: traces at canvas resolution, defers during drag, scales segments on save
- Cut shapes (circle, square, rounded) as independent draggable objects
- Outline rendered behind shape and sticker
- Persist sticker edit settings and show processed preview in grid
- Ruler workspace with draggable, resizable stickers and physical units (inches/cm)
- Potrace-based outline tracing with morphological dilation for smooth bezier outlines
- Auto-crop sticker uploads to remove transparent/empty padding (sharp)

## 2026-07-05
- Desktop file upload button with drag-and-drop

## 2026-07-02
- Initial commit: QR-based sticker upload from iPhone to browser
- Express + WebSocket server, React + Vite client
- Session management, real-time sticker sync between phone and desktop
- Sticker grid with delete, edit modal scaffold
