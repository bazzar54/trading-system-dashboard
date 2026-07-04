# Parts Lookup

Photograph an engineering/industrial part with no readable label — get its
manufacturer part number (MPN) and current supplier availability.

## Pipeline

1. **Capture** — take or upload a photo of a bare part (no barcode/label needed).
2. **Cache check** — the photo is hashed (SHA-256); an identical photo seen
   before returns its saved result instantly with no API call.
3. **Identify** — on a cache miss, the photo is sent to a Claude vision model,
   which describes the part (type, likely size, material) purely from its
   shape and visual features.
4. **Resolve MPN** — the description is ranked against every catalog part
   using TF-IDF weighted cosine similarity (the standard search-relevance
   algorithm, not simple keyword-overlap counting) to find the best-matching
   manufacturer part number.
5. **Supplier lookup** — the MPN is cross-referenced against supplier data
   for supplier part numbers, stock status, lead time, and price. This runs
   fresh even on a cache hit, since availability changes over time.

## Architecture

- **`lib/db.js`** — SQLite (`data/parts-lookup.db`, gitignored, created on
  first run) holding three tables: `parts`, `supplier_offers`, and
  `lookups` (a cache/history of every photo hash processed). Seeded once
  from `data/parts-catalog.json` and `data/suppliers.json`.
- **`lib/matcher.js`** — TF-IDF cosine similarity ranking, so match quality
  keeps working as the catalog grows past a hand-curated dozen entries.
- **`lib/recognize.js`** — Claude vision call (or demo fallback) plus the
  image-hashing used for caching.
- **`lib/lookup.js`** — ties matching + supplier lookup together.
- **`public/`** — installable PWA (manifest + service worker) so it can be
  added to an iPad/iPhone home screen like a real app, no App Store needed.

`data/parts-catalog.json` and `data/suppliers.json` are the seed data —
swap them for a real catalog and live supplier APIs (RS Components,
Farnell, Mouser, Digi-Key, etc.) to go to production. To reseed from
scratch, delete `data/parts-lookup.db*` and restart the server.

## Demo mode vs. live mode

- **No `ANTHROPIC_API_KEY` set:** runs in demo mode. Recognition is a
  deterministic mock (based on a hash of the uploaded image) that always
  returns a valid catalog entry, so you can exercise the full pipeline with
  no credentials.
- **`ANTHROPIC_API_KEY` set:** recognition calls the real Claude API to
  identify the part from the photo. Defaults to `claude-haiku-4-5-20251001`,
  the cheapest current vision-capable model — a single photo identification
  costs a fraction of a cent, so it's safe to leave the key in while testing.

## Setup

```bash
cd parts-lookup
npm install
cp .env.example .env   # optionally add ANTHROPIC_API_KEY
npm start
```

Open http://localhost:3000, take/upload a photo, click "Identify part".

## Testing from your phone or iPad

The app runs on your computer, but you can reach it from your phone/iPad
over the same Wi-Fi network — no deployment needed yet:

1. Find your computer's local IP address:
   - Mac: `ipconfig getifaddr en0` (or check Wi-Fi settings → Details)
   - It looks like `192.168.x.x`
2. Start the server as above (`npm start`).
3. On your phone/iPad (same Wi-Fi), open Safari/Chrome and go to
   `http://<that-ip>:3000` (e.g. `http://192.168.1.42:3000`).
4. Tap the photo input — on mobile this opens your camera directly
   (`capture="environment"` is already set for the rear camera).

This works in demo mode with no API key at all, so you can try the full
photo → result flow today. Add `ANTHROPIC_API_KEY` later, whenever you're
ready for real recognition — no code changes needed, just set the
environment variable and restart.

## Extending

- Add more parts to `data/parts-catalog.json` (name, category, keywords, mpn)
  and reseed, or insert directly into the `parts` table.
- Add supplier rows to `data/suppliers.json` keyed by MPN, or insert directly
  into `supplier_offers`.
- Swap SQLite for Postgres by replacing `lib/db.js`'s driver once this needs
  to run on a hosted server rather than a single machine.
- User accounts and subscription billing aren't built yet — add those once
  there are real customers to onboard, rather than guessing at requirements.
