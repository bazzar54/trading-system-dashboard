require('dotenv').config();
const express = require('express');
const { identifyPart } = require('./lib/recognize');
const { lookupPart } = require('./lib/lookup');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

app.post('/api/identify', async (req, res) => {
  const { imageBase64, mimeType } = req.body;
  if (!imageBase64 || !mimeType) {
    return res.status(400).json({ error: 'imageBase64 and mimeType are required' });
  }

  try {
    const identification = await identifyPart({ imageBase64, mimeType });
    const result = lookupPart(identification);
    res.json({ identification, result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to identify part', detail: err.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Parts lookup running on http://localhost:${port}`);
});
