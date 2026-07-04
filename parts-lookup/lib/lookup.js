const catalog = require('../data/parts-catalog.json');
const suppliers = require('../data/suppliers.json');

function score(entry, terms) {
  const haystack = [entry.name, entry.category, ...entry.keywords].join(' ').toLowerCase();
  return terms.reduce((total, term) => (haystack.includes(term) ? total + 1 : total), 0);
}

function matchCatalog({ description, category, keywords }) {
  const terms = [description, category, ...(keywords || [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2);

  let best = null;
  let bestScore = 0;
  for (const entry of catalog) {
    const s = score(entry, terms);
    if (s > bestScore) {
      bestScore = s;
      best = entry;
    }
  }
  return { match: best, score: bestScore };
}

function lookupSuppliers(mpn) {
  return suppliers[mpn] || [];
}

function lookupPart(identification) {
  const { match, score: matchScore } = matchCatalog(identification);
  if (!match) {
    return { matched: false };
  }
  return {
    matched: true,
    matchScore,
    catalogEntry: match,
    mpn: match.mpn,
    suppliers: lookupSuppliers(match.mpn),
  };
}

module.exports = { lookupPart };
