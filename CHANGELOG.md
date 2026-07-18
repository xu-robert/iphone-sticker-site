# Changelog

## 2026-07-18
- Session link for mobile: shows desktop URL on phone so users can continue editing on their computer

## 2026-07-17
- Server-side upload of edited sticker images via FormData (fixes checkout crash with bordered images)
- Edited stickers saved as PNG to `orders-assets/` with 1500px max resize
- Simplified add-to-cart flow — cart stores server URLs instead of data URLs
- Admin "Download All" button to download order sticker images as a zip file
- Image upload resize: cap longest side at 1500px (300 DPI at max 5" sticker)

## 2026-07-15
- "Print Me to Life" branding, landing page with hero, how-it-works, pricing, and CTA sections
- Shared nav bar with sticky header and cart badge
- Redesigned all pages with consistent design system (CSS variables, new color palette, rounded cards)
- Mobile responsiveness — hide QR on phone, responsive grids, mobile upload flow
- Mobile paste input and drag-drop upload on workspace
- Fixed mobile checkout: correct Stripe redirect URL, cart ID fallback for HTTP, email case sensitivity

## 2026-07-14
- Admin view for order management with password-protected login
- Order list with status filters, expandable details, and status updates

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
