# BookStock — Supabase cloud version

Your Supabase Project URL and **publishable** key are in `config.js`. These are public browser configuration, NOT a database secret. Never add a secret/service_role key to this repository.

## Install
1. In your Supabase project, open **SQL Editor** and run `transfer-setup.sql` once (the earlier `setup.sql` has already been run).
2. In **Authentication → Users**, make sure your user exists and has a confirmed email.
3. Upload `index.html`, `cloud.js`, `config.js`, `manifest.webmanifest` (and optionally this README) to the **root** of your GitHub Pages repository. `app.js` is the old local prototype and is not used.
4. Enable **Settings → Pages → Deploy from branch → main → /(root)** in GitHub.
5. Open your GitHub Pages URL over HTTPS and sign in with your Supabase user email and password. On iPhone Safari you can use Share → Add to Home Screen.
6. Test with a disposable title: receive 2 copies into 1A, receive 3 into 2B, pick 1 from 1A, and confirm the remaining stock is 1 in 1A and 3 in 2B. Verify on your computer and phone.

## Notes
- Data is stored in Supabase, with per-user row-level security based on `auth.uid()`. The database setup must have been applied before using the app.
- Cover OCR runs in the browser using Tesseract.js with Bulgarian+English language data. The library and OCR language models are loaded from third-party hosts; no external book catalogue is used. Review the OCR result carefully. QR scanning uses html5-qrcode and requires HTTPS and camera permission.
- The app requires an internet connection. It is an early working prototype: test thoroughly and maintain independent inventory backups before relying on it for commercial operations.
- Duplicate detection uses exact title+author after case normalisation. Correct spelling before receiving. Book cover photos are not uploaded or stored.
- Transfers require the additional `transfer-setup.sql`. They are transactional and record a pair of `adjust` movements.
- GitHub Pages public repositories expose the source and publishable key; this is expected. Database access must be protected by Supabase authentication and RLS.
