# Parts Lookup — commercial bakery & catering equipment

Photograph a spare part from commercial bakery/catering equipment (doughnut
fryers, bakery ovens, dough dividers/moulders, roll plants…) — get its part
number, which machines it fits, and where to buy it.

**Strategy:** specialist to this industry first, not a universal parts app.
The catalog grows by adding data (more machines, more manuals), not code.
Target users: facilities/maintenance engineers and contractors.

## Pipeline

1. **Capture** — take or upload a photo of a bare part (no barcode/label needed).
2. **Machine filter (optional)** — pick the machine the part came off; the
   search is then limited to that machine's parts list, which makes matches
   much more reliable.
3. **Cache check** — the photo is hashed (SHA-256); an identical photo seen
   before (with the same machine filter) returns its saved result instantly
   with no API call.
4. **Identify** — on a cache miss, the photo is sent to a Claude vision model
   with a prompt tuned to bakery/catering equipment parts (heating elements,
   thermostats, solenoid valves, door seals, drive parts…).
5. **Resolve part number** — the description is ranked against the catalog
   using TF-IDF weighted cosine similarity to find the best-matching part.
6. **Supplier lookup** — the part number is cross-referenced against supplier
   data. Where a supplier lists the part but publishes no price/stock, the
   app shows clearly-marked placeholders ("POA", "Ask supplier") rather than
   made-up numbers.

## Data model

SQLite (`data/parts-lookup.db`, gitignored, rebuilt on first run) with five
tables, seeded from the JSON files in `data/`:

- **`machines`** — appliance models (e.g. MONO Aztec Doughnut Fryer FG059),
  with a link to the manufacturer's spares manual each came from.
- **`parts`** — one row per part number: name, category, keywords,
  manufacturer.
- **`part_machines`** — which parts fit which machines (a thermostat can be
  shared across several models).
- **`supplier_offers`** — real supplier + their listed part number; price,
  stock, and lead time are nullable and shown as placeholders when the
  supplier doesn't publish them.
- **`lookups`** — cache/history of every photo hash processed, per machine
  filter.

The catalog is built from **public manufacturers' spares manuals** (MONO
Equipment publishes spares manuals at monoequip.com; First Choice Group hosts
thousands of exploded parts diagrams). Each machine row records its source
document. To reseed after editing the JSON files, delete
`data/parts-lookup.db*` and restart the server (a schema-version bump does
this automatically).

## Demo mode vs. live mode

- **No `ANTHROPIC_API_KEY` set:** demo mode. Recognition is a deterministic
  mock (based on a hash of the uploaded image) that returns a valid catalog
  entry — respecting the machine filter — so the full pipeline runs with no
  credentials.
- **`ANTHROPIC_API_KEY` set:** recognition calls the real Claude API.
  Defaults to `claude-haiku-4-5-20251001`, the cheapest current
  vision-capable model — a single photo identification costs a fraction of
  a cent.

## Setup

```bash
cd parts-lookup
npm install
cp .env.example .env   # optionally add ANTHROPIC_API_KEY
npm start
```

Open http://localhost:3000, optionally pick a machine, take/upload a photo,
click "Identify part".

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

This works in demo mode with no API key at all. Add `ANTHROPIC_API_KEY`
later — no code changes needed, just set the environment variable and
restart. The app is an installable PWA, so it can be added to a home screen
like a real app.

## Extending the catalog

1. Find the machine's public spares manual (manufacturer download pages, or
   First Choice Group's parts diagrams).
2. Add the machine to `data/machines.json` (id, manufacturer, model, name,
   type, sourceDoc).
3. Add its parts to `data/parts-catalog.json` — each entry lists the
   `machines` ids it fits; parts shared across machines just list several.
4. Add supplier rows to `data/suppliers.json` keyed by part number. Use
   `null` for unknown price/stock — never invent numbers.
5. Delete `data/parts-lookup.db*` and restart (or bump `SCHEMA_VERSION`).

## Later

- Swap SQLite for Postgres by replacing `lib/db.js`'s driver once this runs
  on a hosted server rather than a single machine.
- Live supplier stock/price via supplier APIs where they exist.
- User accounts and subscription billing once there are real customers to
  onboard.
