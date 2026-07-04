# Parts Lookup

Photograph an engineering/industrial part with no readable label — get its
manufacturer part number (MPN) and current supplier availability.

## Pipeline

1. **Capture** — take or upload a photo of a bare part (no barcode/label needed).
2. **Identify** — the photo is sent to a Claude vision model, which describes
   the part (type, likely size, material) purely from its shape and visual
   features.
3. **Resolve MPN** — the description is matched against a local parts catalog
   (`data/parts-catalog.json`) to find the manufacturer part number.
4. **Supplier lookup** — the MPN is cross-referenced against mock supplier
   data (`data/suppliers.json`) for supplier part numbers, stock status,
   lead time, and price.

Both data files are sample/demo data — swap them for a real catalog and live
supplier APIs (RS Components, Farnell, Mouser, Digi-Key, etc.) to go to
production.

## Demo mode vs. live mode

- **No `ANTHROPIC_API_KEY` set:** runs in demo mode. Recognition is a
  deterministic mock (based on a hash of the uploaded image) that always
  returns a valid catalog entry, so you can exercise the full pipeline with
  no credentials.
- **`ANTHROPIC_API_KEY` set:** recognition calls the real Claude API to
  identify the part from the photo.

## Setup

```bash
cd parts-lookup
npm install
cp .env.example .env   # optionally add ANTHROPIC_API_KEY
npm start
```

Open http://localhost:3000, take/upload a photo, click "Identify part".

## Extending

- Add more parts to `data/parts-catalog.json` (name, category, keywords, mpn).
- Add supplier rows to `data/suppliers.json` keyed by MPN.
- Replace `lib/lookup.js`'s keyword matching with a real search/embedding
  index once the catalog grows beyond a hand-curated list.
