# Sticker Grab

Scan a QR code with your iPhone, paste stickers on your phone, and they appear instantly on your computer as PNGs.

## Quick Start

```bash
npm install
cd client && npm install && cd ..
npm run dev
```

Server: `http://localhost:3001` | Client: `http://localhost:5173`

## How It Works

1. Open `http://localhost:5173` on your computer — a QR code appears
2. Scan the QR code with your iPhone camera
3. On the phone page, tap the input area and paste stickers from your sticker keyboard
4. Stickers appear instantly on your computer via WebSocket

## Testing Locally Without a Phone

Simulate a sticker upload with curl:

```bash
# 1. Create a session
SESSION_ID=$(curl -s -X POST http://localhost:3001/api/session | python3 -c "import sys,json; print(json.load(sys.stdin)['sessionId'])")
echo "Session: $SESSION_ID"
echo "Phone URL: http://localhost:5173/phone/$SESSION_ID"

# 2. Upload a test image as if the phone sent it
curl -X POST http://localhost:3001/api/session/$SESSION_ID/upload \
  -F "sticker=@/path/to/your/image.png;type=image/png"
```

Or open the phone URL directly in a second browser tab to test the input flow.

## Architecture

- **Desktop** (`/`) — shows QR code + real-time sticker grid
- **Phone** (`/phone/:sessionId`) — contenteditable input that captures pasted sticker images
- **Backend** — Express server with WebSocket for real-time sync, image uploads saved to `server/uploads/`
- **Sessions** — in-memory Map (resets on server restart), 24h expiry
