/**
 * Airport lookup module.
 *
 * Usage: node scripts/airports.mjs --query "Morocco"
 *
 * Prints a JSON array of matching airports:
 *   [{ iataCode, name, city, country }]
 *
 * If the query matches more than one city, all airports for all matching
 * cities are returned so Claude can ask the user to pick one.
 */

const AIRPORTS_URL =
  'https://www.ryanair.com/api/views/locate/5/airports/en/active';

async function fetchAllAirports() {
  const res = await fetch(AIRPORTS_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch airports: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

function normalize(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Find airports whose city OR country matches the query string.
 *
 * @param {string} query  - Free text: city name, country name, or IATA code
 * @param {object[]} airports - Full airport list from the Ryanair API
 * @returns {{ iataCode: string, name: string, city: string, country: string }[]}
 */
function findAirports(query, airports) {
  const q = normalize(query.trim());

  return airports
    .filter((a) => {
      const city = normalize(a.city?.name ?? '');
      const country = normalize(a.country?.name ?? '');
      const iata = (a.iataCode ?? '').toLowerCase();
      const airportName = normalize(a.name ?? '');
      return (
        city.includes(q) ||
        country.includes(q) ||
        iata === q ||
        airportName.includes(q)
      );
    })
    .map((a) => ({
      iataCode: a.iataCode,
      name: a.name,
      city: a.city?.name ?? '',
      country: a.country?.name ?? '',
    }));
}

// CLI entry point
const args = process.argv.slice(2);
const queryFlagIdx = args.indexOf('--query');

if (queryFlagIdx === -1 || !args[queryFlagIdx + 1]) {
  console.error('Usage: node airports.mjs --query "<city or country>"');
  process.exit(1);
}

const query = args[queryFlagIdx + 1];

try {
  const all = await fetchAllAirports();
  const results = findAirports(query, all);
  console.log(JSON.stringify(results, null, 2));
} catch (err) {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
}
