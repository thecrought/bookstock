# BookStock — starter app

A mobile-friendly book inventory prototype for Bulgarian books.

## Features
- Cover image OCR (Bulgarian + English, via Tesseract.js); editable title and author.
- Receive copies into **the scanned QR location**, never automatically into a prior bin.
- Same title can have stock in multiple locations.
- Search by title or author, pick from a chosen bin, move stock between bins.
- Movement history and JSON backup/restore.
- No Shopify integration, bin manager or QR label generator.

## Important limitations
This first prototype saves data in **browser localStorage**, not a shared cloud database. **Your iPhone and computer will NOT sync** until a backend with authentication and database is connected. Do not use this as your only inventory record. Export backups regularly. Cover photos are processed in the browser, but the OCR/QR libraries and language data are downloaded from third-party CDNs when used; hosting dependencies locally would improve offline/privacy guarantees. Cover photos are not saved. OCR may misidentify titles and authors. The same title+author is treated as one book record, so check spelling carefully. This is a prototype, not production-ready software.

## Running
Host the directory on any HTTPS static host (e.g. Netlify, Cloudflare Pages, GitHub Pages). HTTPS is required for iPhone camera access. Open the hosted URL in Safari, then Share → Add to Home Screen. Open the same URL on a desktop to view the app, but local inventory is independent on each device.

For local desktop testing: `python3 -m http.server 8000` then open `http://localhost:8000` (desktop camera behaviour varies).

## Next build phase
Add authenticated Supabase backend and row-level security, shared books/locations/movements tables, transaction-safe receiving/picking, and automatic sync between iPhone and computer. Move dependencies to the app's own hosting and add a service worker for reliable PWA install/offline behaviour.
