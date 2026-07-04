const path = require('path');
const Database = require('better-sqlite3');
const partsCatalog = require('../data/parts-catalog.json');
const supplierData = require('../data/suppliers.json');

const db = new Database(path.join(__dirname, '..', 'data', 'parts-lookup.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS parts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    keywords TEXT NOT NULL,
    mpn TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS supplier_offers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mpn TEXT NOT NULL,
    supplier TEXT NOT NULL,
    supplier_part_no TEXT NOT NULL,
    in_stock INTEGER NOT NULL,
    qty INTEGER NOT NULL,
    lead_time_days INTEGER NOT NULL,
    price REAL NOT NULL,
    currency TEXT NOT NULL,
    FOREIGN KEY (mpn) REFERENCES parts(mpn)
  );

  CREATE TABLE IF NOT EXISTS lookups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    image_hash TEXT NOT NULL UNIQUE,
    mode TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    keywords TEXT NOT NULL,
    confidence TEXT NOT NULL,
    matched_mpn TEXT,
    match_score REAL,
    created_at TEXT NOT NULL
  );
`);

function seedIfEmpty() {
  const partCount = db.prepare('SELECT COUNT(*) AS n FROM parts').get().n;
  if (partCount > 0) return;

  const insertPart = db.prepare(
    'INSERT INTO parts (id, name, category, keywords, mpn) VALUES (@id, @name, @category, @keywords, @mpn)'
  );
  const insertOffer = db.prepare(
    `INSERT INTO supplier_offers (mpn, supplier, supplier_part_no, in_stock, qty, lead_time_days, price, currency)
     VALUES (@mpn, @supplier, @supplier_part_no, @in_stock, @qty, @lead_time_days, @price, @currency)`
  );

  const seed = db.transaction(() => {
    for (const entry of partsCatalog) {
      insertPart.run({ ...entry, keywords: JSON.stringify(entry.keywords) });
    }
    for (const [mpn, offers] of Object.entries(supplierData)) {
      for (const offer of offers) {
        insertOffer.run({
          mpn,
          supplier: offer.supplier,
          supplier_part_no: offer.supplierPartNo,
          in_stock: offer.inStock ? 1 : 0,
          qty: offer.qty,
          lead_time_days: offer.leadTimeDays,
          price: offer.price,
          currency: offer.currency,
        });
      }
    }
  });
  seed();
}

seedIfEmpty();

function getAllParts() {
  return db
    .prepare('SELECT id, name, category, keywords, mpn FROM parts')
    .all()
    .map((row) => ({ ...row, keywords: JSON.parse(row.keywords) }));
}

function getPartByMpn(mpn) {
  const row = db.prepare('SELECT id, name, category, keywords, mpn FROM parts WHERE mpn = ?').get(mpn);
  return row ? { ...row, keywords: JSON.parse(row.keywords) } : null;
}

function getOffersForMpn(mpn) {
  return db
    .prepare(
      'SELECT supplier, supplier_part_no AS supplierPartNo, in_stock AS inStock, qty, lead_time_days AS leadTimeDays, price, currency FROM supplier_offers WHERE mpn = ?'
    )
    .all(mpn)
    .map((row) => ({ ...row, inStock: Boolean(row.inStock) }));
}

function getCachedLookup(imageHash) {
  return db.prepare('SELECT * FROM lookups WHERE image_hash = ?').get(imageHash);
}

function saveLookup({ imageHash, mode, description, category, keywords, confidence, matchedMpn, matchScore }) {
  db.prepare(
    `INSERT OR IGNORE INTO lookups (image_hash, mode, description, category, keywords, confidence, matched_mpn, match_score, created_at)
     VALUES (@imageHash, @mode, @description, @category, @keywords, @confidence, @matchedMpn, @matchScore, @createdAt)`
  ).run({
    imageHash,
    mode,
    description,
    category,
    keywords: JSON.stringify(keywords || []),
    confidence,
    matchedMpn: matchedMpn || null,
    matchScore: matchScore || null,
    createdAt: new Date().toISOString(),
  });
}

module.exports = { db, getAllParts, getPartByMpn, getOffersForMpn, getCachedLookup, saveLookup };
