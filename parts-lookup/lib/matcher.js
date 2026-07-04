function tokenize(text) {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2);
}

function partDocument(part) {
  return [part.name, part.category, ...part.keywords].join(' ');
}

function buildIdf(documents) {
  const docCount = documents.length;
  const containingDocs = new Map();

  for (const doc of documents) {
    const seen = new Set(tokenize(doc));
    for (const term of seen) {
      containingDocs.set(term, (containingDocs.get(term) || 0) + 1);
    }
  }

  const idf = new Map();
  for (const [term, count] of containingDocs) {
    idf.set(term, Math.log((docCount + 1) / (count + 1)) + 1);
  }
  return idf;
}

function termFrequencyVector(tokens) {
  const tf = new Map();
  for (const token of tokens) {
    tf.set(token, (tf.get(token) || 0) + 1);
  }
  return tf;
}

function tfidfVector(tokens, idf) {
  const tf = termFrequencyVector(tokens);
  const vector = new Map();
  for (const [term, count] of tf) {
    vector.set(term, count * (idf.get(term) || 1));
  }
  return vector;
}

function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const [term, weight] of a) {
    normA += weight * weight;
    if (b.has(term)) dot += weight * b.get(term);
  }
  for (const weight of b.values()) {
    normB += weight * weight;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Ranks catalog parts against an identification's description/category/keywords
 * using TF-IDF weighted cosine similarity, rather than raw keyword-overlap counts.
 */
function rankMatches(parts, identification) {
  const queryText = [identification.description, identification.category, ...(identification.keywords || [])]
    .filter(Boolean)
    .join(' ');

  const documents = parts.map(partDocument);
  const idf = buildIdf(documents);
  const queryVector = tfidfVector(tokenize(queryText), idf);

  const ranked = parts.map((part, i) => ({
    part,
    score: cosineSimilarity(queryVector, tfidfVector(tokenize(documents[i]), idf)),
  }));

  ranked.sort((a, b) => b.score - a.score);
  return ranked;
}

module.exports = { rankMatches };
