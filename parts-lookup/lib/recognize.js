const crypto = require('crypto');
const catalog = require('../data/parts-catalog.json');

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-opus-4-8';

const IDENTIFY_PROMPT = `You are looking at a photo of a single engineering/industrial part with no readable label, barcode, or stamped text visible (identification must come from shape and visual features alone).

Identify the part as specifically as you can (type, likely size, material if visible). Respond with ONLY a JSON object, no markdown fences, no extra text, in this exact shape:
{"description": "short specific description", "category": "one or two word category, e.g. fastener, bearing, seal, valve, connector, relay, fuse, gasket, clamp, bushing", "keywords": ["keyword1", "keyword2", "keyword3"], "confidence": "high|medium|low"}`;

function demoIdentify(imageBuffer) {
  const hash = crypto.createHash('sha256').update(imageBuffer).digest();
  const index = hash[0] % catalog.length;
  const entry = catalog[index];
  return {
    mode: 'demo',
    description: entry.name,
    category: entry.category,
    keywords: entry.keywords,
    confidence: 'medium',
  };
}

async function liveIdentify(imageBase64, mimeType, apiKey, model) {
  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mimeType, data: imageBase64 } },
            { type: 'text', text: IDENTIFY_PROMPT },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${body}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text || '{}';
  const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/, '');
  const parsed = JSON.parse(cleaned);

  return {
    mode: 'live',
    description: parsed.description,
    category: parsed.category,
    keywords: parsed.keywords || [],
    confidence: parsed.confidence || 'medium',
  };
}

async function identifyPart({ imageBase64, mimeType }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return demoIdentify(Buffer.from(imageBase64, 'base64'));
  }
  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
  return liveIdentify(imageBase64, mimeType, apiKey, model);
}

module.exports = { identifyPart };
