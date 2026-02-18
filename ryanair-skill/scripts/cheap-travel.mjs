/**
 * Cheap travel search — find affordable Ryanair return flights across
 * multiple destinations for a fixed departure + return date.
 *
 * Usage:
 *   node scripts/cheap-travel.mjs --json '<params-object>'
 *
 * Params object fields:
 *   origin       {string}   - Origin IATA code (e.g. "DUB")
 *   destinations {string[]} - List of destination IATA codes (e.g. ["BCN","LIS","MAD"])
 *   dateOut      {string}   - Departure date (YYYY-MM-DD)
 *   dateIn       {string}   - Return date (YYYY-MM-DD)
 *   adults       {number}   - Number of adults (default 1)
 *   teens        {number}   - Number of teens (default 0)
 *   children     {number}   - Number of children (default 0)
 *   infants      {number}   - Number of infants (default 0)
 *   budget       {number}   - Max total price in route currency
 *
 * Prints a JSON object:
 *   {
 *     currency: string,
 *     budget: number,
 *     results: [{ destination, destinationName, outbound, inbound, totalPrice }],
 *     skipped: string[]   // destinations with no flights on those exact dates
 *   }
 */

const BASE_URL = 'https://www.ryanair.com/api/booking/v4/en-gb/availability';

function buildUrl({ origin, destination, dateOut, dateIn, adults, teens, children, infants }) {
  const p = new URLSearchParams({
    ADT: String(adults),
    TEE: String(teens),
    CHD: String(children),
    INF: String(infants),
    DateOut: dateOut,
    DateIn: dateIn,
    Origin: origin,
    Destination: destination,
    IncludeConnectingFlights: 'false',
    ToUs: 'AGREED',
    RoundTrip: 'true',
    FlexDaysBeforeOut: '0',
    FlexDaysOut: '0',
    FlexDaysBeforeIn: '0',
    FlexDaysIn: '0',
  });
  return `${BASE_URL}?${p.toString()}`;
}

function totalFare(flight) {
  return (flight.regularFare?.fares ?? []).reduce(
    (sum, f) => sum + f.amount * f.count,
    0
  );
}

function hasAvailableFare(flight) {
  return flight.faresLeft !== 0 && totalFare(flight) > 0;
}

function cheapest(flights) {
  return flights
    .filter(hasAvailableFare)
    .reduce((best, f) => (!best || totalFare(f) < totalFare(best) ? f : best), null);
}

function formatFlight(flight, currency, label) {
  return {
    trip: label,
    flightNumber: flight.flightNumber,
    departureDate: flight.time[0].slice(0, 10),
    departureTime: flight.time[0].slice(11, 16),
    arrivalTime: flight.time[1].slice(11, 16),
    duration: flight.duration,
    price: totalFare(flight),
    currency,
    seatsLeft: flight.faresLeft === -1 ? 'many' : flight.faresLeft,
  };
}

function buildBookingLink({ origin, destination, dateOut, dateIn, adults, teens, children, infants }) {
  const p = new URLSearchParams({
    adults: String(adults),
    teens: String(teens),
    children: String(children),
    infants: String(infants),
    dateOut,
    dateIn,
    isConnectedFlight: 'false',
    discount: '0',
    promoCode: '',
    isReturn: 'true',
    originIata: origin,
    destinationIata: destination,
    tpAdults: String(adults),
    tpTeens: String(teens),
    tpChildren: String(children),
    tpInfants: String(infants),
    tpStartDate: dateOut,
    tpEndDate: dateIn,
    tpDiscount: '0',
    tpPromoCode: '',
    tpOriginIata: origin,
    tpDestinationIata: destination,
  });
  return `https://www.ryanair.com/ie/en/trip/flights/select?${p.toString()}`;
}

/**
 * Search a single destination. Returns a result object or null if no
 * flights exist on those exact dates.
 */
async function searchDestination(params, destination) {
  const url = buildUrl({ ...params, destination });
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
  });

  if (!res.ok) return null;

  const data = await res.json();
  const currency = data.currency ?? 'EUR';
  const trips = data.trips ?? [];

  const outboundFlights = trips[0]?.dates?.[0]?.flights ?? [];
  const inboundFlights  = trips[1]?.dates?.[0]?.flights ?? [];

  if (outboundFlights.length === 0 || inboundFlights.length === 0) return null;

  const bestOut = cheapest(outboundFlights);
  const bestIn  = cheapest(inboundFlights);

  if (!bestOut || !bestIn) return null;

  const totalPrice = totalFare(bestOut) + totalFare(bestIn);

  return {
    destination,
    destinationName: trips[0]?.destinationName ?? destination,
    outbound: formatFlight(bestOut, currency, 'Outbound'),
    inbound: formatFlight(bestIn, currency, 'Return'),
    totalPrice: Math.round(totalPrice * 100) / 100,
    currency,
    bookingLink: buildBookingLink({ ...params, destination }),
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const jsonFlagIdx = args.indexOf('--json');

if (jsonFlagIdx === -1 || !args[jsonFlagIdx + 1]) {
  console.error(
    'Usage: node cheap-travel.mjs --json \'{"origin":"DUB","destinations":["BCN","LIS"],"dateOut":"2026-03-10","dateIn":"2026-03-17","adults":1,"budget":200}\''
  );
  process.exit(1);
}

let params;
try {
  params = JSON.parse(args[jsonFlagIdx + 1]);
} catch {
  console.error(JSON.stringify({ error: 'Invalid JSON params' }));
  process.exit(1);
}

const {
  origin,
  destinations,
  dateOut,
  dateIn,
  adults = 1,
  teens = 0,
  children = 0,
  infants = 0,
  budget,
} = params;

if (!origin || !Array.isArray(destinations) || destinations.length === 0 || !dateOut || !dateIn || budget == null) {
  console.error(JSON.stringify({ error: 'Missing required params: origin, destinations, dateOut, dateIn, budget' }));
  process.exit(1);
}

const base = { origin, dateOut, dateIn, adults, teens, children, infants };

// Fetch all destinations in parallel
const settled = await Promise.allSettled(
  destinations.map((dest) => searchDestination(base, dest))
);

const skipped = [];
const affordable = [];

for (let i = 0; i < destinations.length; i++) {
  const { status, value } = settled[i];
  const dest = destinations[i];

  if (status !== 'fulfilled' || value === null) {
    skipped.push(dest);
    continue;
  }

  if (value.totalPrice <= budget) {
    affordable.push(value);
  }
  // over budget — silently drop (no flights issue is skipped, over-budget is just not shown)
}

// Sort cheapest first
affordable.sort((a, b) => a.totalPrice - b.totalPrice);

console.log(
  JSON.stringify(
    {
      currency: affordable[0]?.currency ?? 'EUR',
      budget,
      results: affordable,
      skipped,
    },
    null,
    2
  )
);
