/**
 * Flight search module.
 *
 * Usage:
 *   node scripts/search-flights.mjs --json '<params-object>'
 *
 * Params object fields:
 *   origin          {string}  - Origin IATA code (e.g. "DUB")
 *   destination     {string}  - Destination IATA code (e.g. "LGW")
 *   dateOut         {string}  - Departure date (YYYY-MM-DD)
 *   dateIn          {string}  - Return date (YYYY-MM-DD), omit for one-way
 *   adults          {number}  - Number of adults (default 1)
 *   teens           {number}  - Number of teens (default 0)
 *   children        {number}  - Number of children (default 0)
 *   infants         {number}  - Number of infants (default 0)
 *   departureTimeFrom {string} - Optional earliest departure time "HH:MM"
 *   departureTimeTo   {string} - Optional latest departure time "HH:MM"
 *
 * Prints a JSON object with the cheapest flight option(s).
 */

const BASE_URL = 'https://www.ryanair.com/api/booking/v4/en-gb/availability';

function buildUrl(params) {
  const {
    origin,
    destination,
    dateOut,
    dateIn,
    adults = 1,
    teens = 0,
    children = 0,
    infants = 0,
  } = params;

  const isReturn = Boolean(dateIn);
  const p = new URLSearchParams({
    ADT: String(adults),
    TEE: String(teens),
    CHD: String(children),
    INF: String(infants),
    DateOut: dateOut,
    Origin: origin,
    Destination: destination,
    IncludeConnectingFlights: 'false',
    ToUs: 'AGREED',
    RoundTrip: String(isReturn),
    FlexDaysBeforeOut: '0',
    FlexDaysOut: '0',
  });

  if (isReturn) {
    p.set('DateIn', dateIn);
    p.set('FlexDaysBeforeIn', '0');
    p.set('FlexDaysIn', '0');
  }

  return `${BASE_URL}?${p.toString()}`;
}

function timeToMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function extractTimeHHMM(isoDateTime) {
  // "2026-03-01T06:35:00.000" → "06:35"
  return isoDateTime.slice(11, 16);
}

/**
 * Calculate total price for a flight across all passenger types.
 * @param {object} flight
 * @returns {number}
 */
function totalFare(flight) {
  const fares = flight.regularFare?.fares ?? [];
  return fares.reduce((sum, f) => sum + f.amount * f.count, 0);
}

/**
 * Format a flight into a clean result object.
 */
function formatFlight(flight, currency, tripLabel) {
  const seg = flight.segments?.[0] ?? {};
  const depTime = extractTimeHHMM(flight.time[0]);
  const arrTime = extractTimeHHMM(flight.time[1]);
  const depDate = flight.time[0].slice(0, 10);

  return {
    trip: tripLabel,
    flightNumber: flight.flightNumber,
    departureDate: depDate,
    departureTime: depTime,
    arrivalTime: arrTime,
    duration: flight.duration,
    price: totalFare(flight),
    currency,
    seatsLeft: flight.faresLeft === -1 ? 'many' : flight.faresLeft,
  };
}

/**
 * Filter flights by optional departure time window.
 */
function filterByTime(flights, fromHHMM, toHHMM) {
  if (!fromHHMM && !toHHMM) return flights;
  return flights.filter((f) => {
    const dep = timeToMinutes(extractTimeHHMM(f.time[0]));
    const lo = fromHHMM ? timeToMinutes(fromHHMM) : 0;
    const hi = toHHMM ? timeToMinutes(toHHMM) : 24 * 60;
    return dep >= lo && dep <= hi;
  });
}

/**
 * Find cheapest flight in a list.
 */
function cheapest(flights) {
  return flights.reduce(
    (best, f) => (!best || totalFare(f) < totalFare(best) ? f : best),
    null
  );
}

function buildBookingLink(params, outFlight, inFlight) {
  const {
    origin,
    destination,
    dateOut,
    dateIn,
    adults = 1,
    teens = 0,
    children = 0,
    infants = 0,
  } = params;

  const isReturn = Boolean(dateIn);
  const p = new URLSearchParams({
    adults: String(adults),
    teens: String(teens),
    children: String(children),
    infants: String(infants),
    dateOut,
    isConnectedFlight: 'false',
    discount: '0',
    promoCode: '',
    isReturn: String(isReturn),
    originIata: origin,
    destinationIata: destination,
    tpAdults: String(adults),
    tpTeens: String(teens),
    tpChildren: String(children),
    tpInfants: String(infants),
    tpStartDate: dateOut,
    tpEndDate: dateIn ?? dateOut,
    tpDiscount: '0',
    tpPromoCode: '',
    tpOriginIata: origin,
    tpDestinationIata: destination,
  });

  if (isReturn && dateIn) p.set('dateIn', dateIn);

  return `https://www.ryanair.com/ie/en/trip/flights/select?${p.toString()}`;
}

/**
 * Fetch available dates for a route and return the N closest to targetDate.
 * @param {string} origin
 * @param {string} destination
 * @param {string} targetDate  YYYY-MM-DD
 * @param {number} count       How many nearby dates to return (default 5)
 * @returns {Promise<string[]>}
 */
async function nearbyAvailableDates(origin, destination, targetDate, count = 5) {
  const url = `https://www.ryanair.com/api/farfnd/v4/oneWayFares/${origin}/${destination}/availabilities`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
  });
  if (!res.ok) return [];
  const dates = await res.json(); // string[]
  if (!Array.isArray(dates) || dates.length === 0) return [];

  const target = new Date(targetDate).getTime();
  return dates
    .map((d) => ({ d, diff: Math.abs(new Date(d).getTime() - target) }))
    .sort((a, b) => a.diff - b.diff)
    .slice(0, count)
    .sort((a, b) => a.d.localeCompare(b.d)) // chronological order
    .map((x) => x.d);
}

// ── Main ──────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const jsonFlagIdx = args.indexOf('--json');

if (jsonFlagIdx === -1 || !args[jsonFlagIdx + 1]) {
  console.error(
    'Usage: node search-flights.mjs --json \'{"origin":"DUB","destination":"LGW","dateOut":"2026-03-01","adults":1}\''
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

const { departureTimeFrom, departureTimeTo } = params;

try {
  const url = buildUrl(params);
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const currency = data.currency ?? 'EUR';
  const trips = data.trips ?? [];

  // Outbound (always trips[0])
  const outboundFlights = trips[0]?.dates?.[0]?.flights ?? [];

  if (trips.length === 0 || outboundFlights.length === 0) {
    const nearby = await nearbyAvailableDates(params.origin, params.destination, params.dateOut);
    console.log(
      JSON.stringify({
        error: 'No flights found for this route on the requested date.',
        availableDates: nearby,
      })
    );
    process.exit(0);
  }

  const filteredOutbound = filterByTime(outboundFlights, departureTimeFrom, departureTimeTo);

  if (filteredOutbound.length === 0) {
    console.log(
      JSON.stringify({
        error: 'No outbound flights found within the requested time window.',
        hint: 'Try widening the time range or removing the time filter.',
      })
    );
    process.exit(0);
  }

  const bestOutbound = cheapest(filteredOutbound);

  const result = {
    currency,
    outbound: formatFlight(bestOutbound, currency, 'Outbound'),
    totalPrice: totalFare(bestOutbound),
    bookingLink: buildBookingLink(params, bestOutbound, null),
  };

  // Inbound (return trip — trips[1])
  if (params.dateIn && trips[1]) {
    const inboundFlights = trips[1]?.dates?.[0]?.flights ?? [];
    const filteredInbound = filterByTime(inboundFlights, null, null); // no time filter on return
    const bestInbound = cheapest(filteredInbound);

    if (bestInbound) {
      result.inbound = formatFlight(bestInbound, currency, 'Return');
      result.totalPrice = totalFare(bestOutbound) + totalFare(bestInbound);
      result.bookingLink = buildBookingLink(params, bestOutbound, bestInbound);
    }
  }

  console.log(JSON.stringify(result, null, 2));
} catch (err) {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
}
