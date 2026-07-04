const { getAllParts, getOffersForMpn, getMachinesForPart } = require('./db');
const { rankMatches } = require('./matcher');

const MIN_SCORE = 0.05;

function lookupPart(identification, machineId) {
  const parts = getAllParts(machineId);
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
    machines: getMachinesForPart(best.part.id),
    suppliers: getOffersForMpn(best.part.mpn),
  };
}

module.exports = { lookupPart };
