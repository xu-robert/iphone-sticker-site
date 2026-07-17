# Print Me to Life

Custom sticker ordering app. Users upload images from their phone (via QR code pairing), edit them in a browser-based sticker editor, and order printed stickers through Stripe checkout.

## Quick Start

```bash
npm install
cd client && npm install && cd ..
npm run dev
```

Runs the Express server on `:3001` and Vite dev server on `:5173`.

For production: `npm run build && npm start` (serves the built client from Express).

## Environment Variables

Create a `.env` in the project root:

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_CURRENCY=cad                    # or usd — used for Stripe checkout
RESEND_API_KEY=re_...
RESEND_FROM=orders@yourdomain.com
ADMIN_PASSWORD=your-admin-password

# Shippo (optional — falls back to format validation + flat-rate estimates without it)
SHIPPO_API_TOKEN=shippo_test_...
SHIPPO_ORIGIN_NAME=Print Me to Life
SHIPPO_ORIGIN_STREET=123 Main St
SHIPPO_ORIGIN_CITY=Toronto
SHIPPO_ORIGIN_STATE=ON
SHIPPO_ORIGIN_ZIP=M5V1A1
SHIPPO_ORIGIN_COUNTRY=CA
```

All are optional for local dev — features degrade gracefully (no payments, no emails, no admin, estimated shipping rates).

## Architecture

```
client/                     React SPA (Vite)
  src/
    pages/
      LandingPage.jsx       Marketing landing page at /
      DesktopPage.jsx       Main workspace at /workspace — QR code + drag-and-drop upload
      PhonePage.jsx         Phone capture page at /phone/:sessionId — paste stickers from keyboard
      CartPage.jsx          Shopping cart + Stripe checkout trigger
      OrderConfirmationPage Order success page after Stripe redirect
      OrderLookupPage.jsx   Track order by reference number + email
      AdminPage.jsx         Password-protected admin panel for managing orders
    components/
      EditModal.jsx         Sticker editor — resize, cut shapes, outline, background removal
                            Desktop: ruler workspace with drag-to-resize
                            Mobile: full-screen layout with touch drag, simplified controls
      StickerGrid.jsx       Grid of uploaded stickers with edit/order/delete actions
      AddToCartModal.jsx    Size + quantity picker when adding a sticker to cart
      CartDrawer.jsx        Slide-in cart panel from the right side
      CartBadge.jsx         Nav bar cart icon with item count badge
      ConnectionStatus.jsx  WebSocket connection indicator (connected/reconnecting/offline)
      Layout.jsx            Shared nav bar + cart drawer wrapper for all public routes
    context/
      CartContext.jsx       Cart state (items, add/remove, drawer open/close, pricing)
    hooks/
      useWebSocket.js       WebSocket connection with auto-reconnect
      useIsMobile.js        Media query hook (breakpoint at 768px)
    helpers/
      contourTracing.js     Traces sticker outlines as bezier curves for cut lines
      rmbgModel.js          Client-side background removal using ONNX Runtime (RMBG model)
    index.css               CSS custom properties design system (colors, radii, shadows)
    main.jsx                React Router setup

server/
  index.js                  Express + WebSocket server, Stripe checkout/webhooks, image upload,
                            order API, admin API, Resend email integration
  shipping.js               Shippo API integration — address validation, multi-carrier shipping
                            rates, delivery estimates. Falls back to format checks + flat rates
  sessions.js               In-memory session store (phone-to-desktop pairing), 24h expiry
  db.js                     SQLite database for orders and order items (better-sqlite3)
  pricing.js                Sticker size/price definitions and shipping cost
  uploads/                  Uploaded sticker images (gitignored)
  orders-assets/            Finalized sticker images saved at checkout (gitignored)
  orders.db                 SQLite database file (auto-created, gitignored)
```

## How It Works

1. **Upload**: Open `/workspace` on your computer. A QR code appears. Scan it with your phone to open the phone capture page, then paste stickers from your keyboard. They sync to the desktop via WebSocket in real time. You can also drag-and-drop or upload files directly on desktop.

2. **Edit**: Click "Edit" on any sticker to open the editor. Remove backgrounds (runs an ML model in-browser), add outlines, choose cut shapes (contour/circle/square/rounded), and resize. On mobile the editor is simplified — full-screen with touch drag/resize and just the essential toggles.

3. **Order**: Add stickers to cart (pick size + quantity), review in the slide-in cart drawer, then checkout via Stripe. After payment, a confirmation email is sent via Resend with the order reference.

4. **Admin**: Go to `/admin` and log in with `ADMIN_PASSWORD`. View all orders, filter by status, update order status (processing/shipped/delivered).

## Key Technical Details

- **Phone-to-desktop sync**: WebSocket-based. The server creates a session, phone uploads images to it, desktop receives them in real time.
- **Background removal**: Runs entirely client-side using ONNX Runtime with the RMBG model (~40MB, loaded on demand).
- **Contour tracing**: Generates bezier curve outlines around stickers for die-cut lines.
- **Cart persistence**: Stored in localStorage so it survives page refreshes. Cleared on successful checkout.
- **Shipping**: Shippo API for address validation, multi-carrier shipping rates (Canada Post, USPS, UPS, FedEx), and delivery estimates. Falls back to format validation + flat-rate estimates when `SHIPPO_API_TOKEN` isn't set.
- **Payments**: Stripe Checkout Sessions with webhook for payment confirmation. Currency configurable via `STRIPE_CURRENCY`.
- **Emails**: Order confirmation via Resend. Recipient emails are lowercased before sending (Resend is case-sensitive).
