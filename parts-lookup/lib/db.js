const path = require('path');
const Database = require('better-sqlite3');
const machinesData = require('../data/machines.json');
const partsCatalog = require('../data/parts-catalog.json');
const supplierData = require('../data/suppliers.json');

const db = new Database(path.join(__dirname, '..', 'data', 'parts-lookup.db'));
db.pragma('journal_mode = WAL');

// Bump when the table shapes change; existing databases are rebuilt from the
// JSON seed files (the only thing lost is the photo-lookup cache).
const SCHEMA_VERSION = 2;

if (db.pragma('user_version', { simple: true }) !== SCHEMA_VERSION) {
  db.exec(`
    DROP TABLE IF EXISTS part_machines;
    DROP TABLE IF EXISTS supplier_offers;
    DROP TABLE IF EXISTS lookups;
    DROP TABLE IF EXISTS machines;
    DROP TABLE IF EXISTS parts;
  `);
  db.pragma(`user_version = ${SCHEMA_VERSION}`);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS machines (
    id TEXT PRIMARY KEY,
    manufacturer TEXT NOT NULL,
    model TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    source_doc TEXT
  );

  CREATE TABLE IF NOT EXISTS parts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    keywords TEXT NOT NULL,
    mpn TEXT NOT NULL UNIQUE,
    manufacturer TEXT
  );

  CREATE TABLE IF NOT EXISTS part_machines (
    part_id TEXT NOT NULL REFERENCES parts(id),
    machine_id TEXT NOT NULL REFERENCES machines(id),
    PRIMARY KEY (part_id, machine_id)
  );

  CREATE TABLE IF NOT EXISTS supplier_offers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mpn TEXT NOT NULL,
    supplier TEXT NOT NULL,
    supplier_part_no TEXT NOT NULL,
    in_stock INTEGER,
    qty INTEGER,
    lead_time_days INTEGER,
    price REAL,
    currency TEXT NOT NULL,
    note TEXT,
    FOREIGN KEY (mpn) REFERENCES parts(mpn)
  );

  CREATE TABLE IF NOT EXISTS lookups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    image_hash TEXT NOT NULL,
    machine_id TEXT NOT NULL DEFAULT '',
    mode TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    keywords TEXT NOT NULL,
    confidence TEXT NOT NULL,
    matched_mpn TEXT,
    match_score REAL,
    created_at TEXT NOT NULL,
    UNIQUE (image_hash, machine_id)
  );
`);

function seedIfEmpty() {
  const partCount = db.prepare('SELECT COUNT(*) AS n FROM parts').get().n;
  if (partCount > 0) return;

  const insertMachine = db.prepare(
    'INSERT INTO machines (id, manufacturer, model, name, type, source_doc) VALUES (@id, @manufacturer, @model, @name, @type, @sourceDoc)'
  );
  const insertPart = db.prepare(
    'INSERT INTO parts (id, name, category, keywords, mpn, manufacturer) VALUES (@id, @name, @category, @keywords, @mpn, @manufacturer)'
  );
  const insertPartMachine = db.prepare(
    'INSERT INTO part_machines (part_id, machine_id) VALUES (?, ?)'
  );
  const insertOffer = db.prepare(
    `INSERT INTO supplier_offers (mpn, supplier, supplier_part_no, in_stock, qty, lead_time_days, price, currency, note)
     VALUES (@mpn, @supplier, @supplier_part_no, @in_stock, @qty, @lead_time_days, @price, @currency, @note)`
  );

  const seed = db.transaction(() => {
    for (const machine of machinesData) {
      insertMachine.run({
        id: machine.id,
        manufacturer: machine.manufacturer,
        model: machine.model,
        name: machine.name,
        type: machine.type,
        sourceDoc: machine.sourceDoc || null,
      });
    }
    for (const entry of partsCatalog) {
      insertPart.run({
        id: entry.id,
        name: entry.name,
        category: entry.category,
        keywords: JSON.stringify(entry.keywords),
        mpn: entry.mpn,
        manufacturer: entry.manufacturer || null,
      });
      for (const machineId of entry.machines || []) {
        insertPartMachine.run(entry.id, machineId);
      }
    }
    for (const [mpn, offers] of Object.entries(supplierData)) {
      for (const offer of offers) {
        insertOffer.run({
          mpn,
          supplier: offer.supplier,
          supplier_part_no: offer.supplierPartNo,
          in_stock: offer.inStock == null ? null : offer.inStock ? 1 : 0,
          qty: offer.qty ?? null,
          lead_time_days: offer.leadTimeDays ?? null,
          price: offer.price ?? null,
          currency: offer.currency || 'GBP',
          note: offer.note || null,
        });
      }
    }
  });
  seed();
}

seedIfEmpty();

function rowToPart(row) {
  return { ...row, keywords: JSON.parse(row.keywords) };
}

function getAllMachines() {
  return db
    .prepare(
      `SELECT m.id, m.manufacturer, m.model, m.name, m.type, m.source_doc AS sourceDoc,
              COUNT(pm.part_id) AS partCount
       FROM machines m LEFT JOIN part_machines pm ON pm.machine_id = m.id
       GROUP BY m.id ORDER BY m.manufacturer, m.name`
    )
    .all();
}

function getAllParts(machineId) {
  if (machineId) {
    return db
      .prepare(
        `SELECT p.id, p.name, p.category, p.keywords, p.mpn, p.manufacturer
         FROM parts p JOIN part_machines pm ON pm.part_id = p.id
         WHERE pm.machine_id = ?`
      )
      .all(machineId)
      .map(rowToPart);
  }
  return db
    .prepare('SELECT id, name, category, keywords, mpn, manufacturer FROM parts')
    .all()
    .map(rowToPart);
}

function getPartByMpn(mpn) {
  const row = db
    .prepare('SELECT id, name, category, keywords, mpn, manufacturer FROM parts WHERE mpn = ?')
    .get(mpn);
  return row ? rowToPart(row) : null;
}

function getMachinesForPart(partId) {
  return db
    .prepare(
      `SELECT m.id, m.manufacturer, m.model, m.name, m.type
       FROM machines m JOIN part_machines pm ON pm.machine_id = m.id
       WHERE pm.part_id = ? ORDER BY m.name`
    )
    .all(partId);
}

function getOffersForMpn(mpn) {
  return db
    .prepare(
      `SELECT supplier, supplier_part_no AS supplierPartNo, in_stock AS inStock, qty,
              lead_time_days AS leadTimeDays, price, currency, note
       FROM supplier_offers WHERE mpn = ?`
    )
    .all(mpn)
    .map((row) => ({ ...row, inStock: row.inStock == null ? null : Boolean(row.inStock) }));
}

function getCachedLookup(imageHash, machineId) {
  return db
    .prepare('SELECT * FROM lookups WHERE image_hash = ? AND machine_id = ?')
    .get(imageHash, machineId || '');
}

function saveLookup({ imageHash, machineId, mode, description, category, keywords, confidence, matchedMpn, matchScore }) {
  db.prepare(
    `INSERT OR IGNORE INTO lookups (image_hash, machine_id, mode, description, category, keywords, confidence, matched_mpn, match_score, created_at)
     VALUES (@imageHash, @machineId, @mode, @description, @category, @keywords, @confidence, @matchedMpn, @matchScore, @createdAt)`
  ).run({
    imageHash,
    machineId: machineId || '',
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

module.exports = {
  db,
  getAllMachines,
  getAllParts,
  getPartByMpn,
  getMachinesForPart,
  getOffersForMpn,
  getCachedLookup,
  saveLookup,
};
