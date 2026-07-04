const crypto = require('crypto');
const { getAllParts } = require('./db');

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

const IDENTIFY_PROMPT = `You are looking at a photo of a single spare part from COMMERCIAL BAKERY OR CATERING EQUIPMENT — machines such as doughnut fryers, bakery deck/convection/rack ovens, provers, dough dividers, dough moulders, roll plants, planetary mixers, and similar back-of-house food production equipment. The part may have no readable label, barcode, or stamped text, so identify it from shape and visual features alone.

Typical parts from this equipment include: heating elements, thermostats, thermocouples, high-limit cutouts, solenoid valves, gas valves, burner components, drive motors, gearboxes, drive belts and chains, sprockets, bearings, bushes, door hinges/handles/seals, glass panels, fans and impellers, contactors, relays, switches, timers, controllers/PCBs, indicator lamps, probes and sensors, castors, and food-contact items like conveyor mesh, frying baskets, turner bars, hopper and depositor parts.

Identify the part as specifically as you can (type, likely size, material if visible), leaning towards bakery/catering-equipment interpretations when the shape is ambiguous. Respond with ONLY a JSON object, no markdown fences, no extra text, in this exact shape:
{"description": "short specific description", "category": "one or two word category, e.g. heating element, thermostat, solenoid valve, motor, belt, bearing, door seal, switch, sensor, timer", "keywords": ["keyword1", "keyword2", "keyword3"], "confidence": "high|medium|low"}`;

function hashImage(imageBase64) {
  return crypto.createHash('sha256').update(imageBase64, 'base64').digest('hex');
}

function demoIdentify(imageHash, machineId) {
  let catalog = getAllParts(machineId);
  if (catalog.length === 0) catalog = getAllParts();
  const index = parseInt(imageHash.slice(0, 8), 16) % catalog.length;
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

async function identifyPart({ imageBase64, mimeType, imageHash, machineId }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return demoIdentify(imageHash, machineId);
  }
  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
  return liveIdentify(imageBase64, mimeType, apiKey, model);
}

module.exports = { identifyPart, hashImage };
