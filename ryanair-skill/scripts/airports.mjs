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
 *
 * Airport data is read from the bundled resources/airports.json —
 * no API call needed.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const AIRPORTS_FILE = join(__dir, '..', 'resources', 'airports.json');

function loadAllAirports() {
  return JSON.parse(readFileSync(AIRPORTS_FILE, 'utf8'));
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
      const city = normalize(a.city ?? '');
      const country = normalize(a.country ?? '');
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
      city: a.city ?? '',
      country: a.country ?? '',
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
  const all = loadAllAirports();
  const results = findAirports(query, all);
  console.log(JSON.stringify(results, null, 2));
} catch (err) {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
}
