RECORD SPEND — iPhone spending tracker

The app has no server-side database. It saves transactions in the iPhone's local IndexedDB storage.

INSTALLATION
1. Upload all files in this folder together to any HTTPS static website host, retaining filenames. For example, create a GitHub repository and enable GitHub Pages, or use a static-site host.
2. Open the resulting HTTPS site in Safari on your iPhone.
3. Tap Share > Add to Home Screen > Add.
4. Open Record Spend from its new Home Screen icon.
5. Test a purchase, confirm it appears in History and Dashboard, then delete the test purchase.

The downloaded HTML file opened directly from Files is NOT a reliable substitute for hosting: service workers require a secure origin and persistent browser storage may behave differently.

DATA AND BACKUP
- All data stays in local browser storage; no transaction data is uploaded by the app.
- Use Settings > Back up everything (JSON) and save the downloaded file in iCloud Drive regularly.
- Settings > Restore a JSON backup replaces current data after confirmation.
- Settings > Export transactions (CSV) produces a Numbers-compatible file.
- Safari website data clearing, app deletion, device loss or storage eviction can erase local data.
- iPhone and iPad data do not automatically sync.

The app uses calendar months and shared monthly category budgets. Amounts are stored as integer pence to avoid rounding errors. Negative amounts can be imported as refunds, but manual entry is for positive purchases.
