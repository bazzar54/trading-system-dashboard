require('dotenv').config();
const express = require('express');
const { identifyPart, hashImage } = require('./lib/recognize');
const { lookupPart } = require('./lib/lookup');
const {
  getAllMachines,
  getCachedLookup,
  saveLookup,
  getOffersForMpn,
  getPartByMpn,
  getMachinesForPart,
} = require('./lib/db');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

app.get('/api/machines', (req, res) => {
  res.json({ machines: getAllMachines() });
});

app.post('/api/identify', async (req, res) => {
  const { imageBase64, mimeType, machineId } = req.body;
  if (!imageBase64 || !mimeType) {
    return res.status(400).json({ error: 'imageBase64 and mimeType are required' });
  }

  try {
    const imageHash = hashImage(imageBase64);
    // Cache is per photo AND per machine filter — the same photo can match a
    // different part when the search is narrowed to one machine.
    const cached = getCachedLookup(imageHash, machineId);

    let identification;
    let result;
    let cacheHit = false;

    if (cached) {
      cacheHit = true;
      identification = {
        mode: cached.mode,
        description: cached.description,
        category: cached.category,
        keywords: JSON.parse(cached.keywords),
        confidence: cached.confidence,
      };
      // Supplier availability is re-fetched fresh even on a cache hit, since
      // stock/price can change between lookups of the same part.
      const cachedPart = cached.matched_mpn ? getPartByMpn(cached.matched_mpn) : null;
      result = cachedPart
        ? {
            matched: true,
            matchScore: cached.match_score,
            catalogEntry: cachedPart,
            mpn: cached.matched_mpn,
            machines: getMachinesForPart(cachedPart.id),
            suppliers: getOffersForMpn(cached.matched_mpn),
          }
        : { matched: false };
    } else {
      identification = await identifyPart({ imageBase64, mimeType, imageHash, machineId });
      result = lookupPart(identification, machineId);
      saveLookup({
        imageHash,
        machineId,
        mode: identification.mode,
        description: identification.description,
        category: identification.category,
        keywords: identification.keywords,
        confidence: identification.confidence,
        matchedMpn: result.matched ? result.mpn : null,
        matchScore: result.matched ? result.matchScore : null,
      });
    }

    res.json({ identification, result, cacheHit });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to identify part', detail: err.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Parts lookup running on http://localhost:${port}`);
});
