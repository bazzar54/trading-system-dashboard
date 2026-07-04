require('dotenv').config();
const express = require('express');
const { identifyPart, hashImage } = require('./lib/recognize');
const { lookupPart } = require('./lib/lookup');
const { getCachedLookup, saveLookup, getOffersForMpn, getPartByMpn } = require('./lib/db');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

app.post('/api/identify', async (req, res) => {
  const { imageBase64, mimeType } = req.body;
  if (!imageBase64 || !mimeType) {
    return res.status(400).json({ error: 'imageBase64 and mimeType are required' });
  }

  try {
    const imageHash = hashImage(imageBase64);
    const cached = getCachedLookup(imageHash);

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
      result = cached.matched_mpn
        ? {
            matched: true,
            matchScore: cached.match_score,
            catalogEntry: getPartByMpn(cached.matched_mpn),
            mpn: cached.matched_mpn,
            suppliers: getOffersForMpn(cached.matched_mpn),
          }
        : { matched: false };
    } else {
      identification = await identifyPart({ imageBase64, mimeType, imageHash });
      result = lookupPart(identification);
      saveLookup({
        imageHash,
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
