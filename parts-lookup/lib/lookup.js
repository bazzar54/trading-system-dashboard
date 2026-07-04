const { getAllParts, getOffersForMpn } = require('./db');
const { rankMatches } = require('./matcher');

const MIN_SCORE = 0.05;

function lookupPart(identification) {
  const parts = getAllParts();
  const ranked = rankMatches(parts, identification);
  const best = ranked[0];

  if (!best || best.score < MIN_SCORE) {
    return { matched: false };
  }

  return {
    matched: true,
    matchScore: best.score,
    catalogEntry: best.part,
    mpn: best.part.mpn,
    suppliers: getOffersForMpn(best.part.mpn),
  };
}

module.exports = { lookupPart };
