# Quote Builder Extension

Chrome extension for capturing B&H and Amazon product details and appending them to Google Sheets through a Google Apps Script web app.

## Demo

![Quote Builder demo](https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExZGw2azd5ejE1aXNtZGNiM2R2Nnh1NTFsanVvYnNxeHNobm0wd3J5ZiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/q9ILnYJPPSLICVl5Hl/giphy.gif)

## Features

- Manifest V3 Chrome extension
- Popup-driven capture on B&H and Amazon product detail pages
- Multiple spreadsheet destinations with one default destination
- Configurable header-name mappings per destination
- Quantity and notes fields before save
- Apps Script backend that appends rows by matching header names

## Project Structure

```text
public/manifest.json         Chrome extension manifest
src/background/index.ts      Service worker that writes to Apps Script
src/content/bh-product.ts    B&H product scraper content script
src/popup/                   Popup UI
src/options/                 Options UI
src/shared/                  Shared types and helpers
apps-script/Code.gs          Apps Script backend
```

## Local Development

```bash
npm install
npm run build
npm test
```

The built extension will be in `dist/`.

## Load Unpacked in Chrome

1. Open `chrome://extensions`.
2. Turn on Developer mode.
3. Click Load unpacked.
4. Select the `dist/` folder from this repo.

## Keyboard Shortcut

The extension defines a default shortcut of `Alt+Shift+Q` to open the popup. You can change it in `chrome://extensions/shortcuts`.

## Configure Apps Script

1. Create a standalone Google Apps Script project.
2. Copy the contents of [apps-script/Code.gs](/Users/ethanvosburg/Documents/git/quote-builder-extension/apps-script/Code.gs) into the script project.
3. In Apps Script, set a script property named `QUOTE_BUILDER_SECRET` to your shared secret.
4. Deploy the script as a web app.
5. Copy the deployment URL.

Notes:
- Apps Script web apps do not expose custom request headers in `doPost(e)`, so the extension includes the shared secret in the JSON body for validation.
- The extension still sends the `X-Quote-Builder-Secret` header for consistency with the planned transport contract.

## Configure the Extension

1. Open the extension Options page.
2. Paste the Apps Script web app URL.
3. Enter the shared secret.
4. Add one or more destinations:
   - destination label
   - spreadsheet URL or raw spreadsheet ID
   - tab name
   - header names for any fields you want to save
   - optional required/optional toggle per field
   - available fields: `source`, `vendor`, `title`, `price`, `url`, `timestamp`, `quantity`, `notes`
5. Mark one destination as default.

## Expected Sheet Headers

The Apps Script appends rows by matching the configured header names in the first row of the target tab. Any mapped field can be marked required or optional. Available fields:

- `source`
- `vendor`
- `title`
- `price`
- `url`
- `timestamp`
- `quantity`
- `notes`

## Manual QA Checklist

1. Build the extension and load `dist/` unpacked in Chrome.
2. Configure Apps Script settings and at least one destination.
3. Open a B&H or Amazon product detail page.
4. Open the popup and confirm title, price, and canonical URL preview.
5. Save with quantity and notes.
6. Confirm the row appears in the expected Google Sheet tab.
7. Add a second destination and confirm destination switching works in the popup.
8. Test an invalid mapping and confirm the error returns from Apps Script.
