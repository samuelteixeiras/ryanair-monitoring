# Ryanair Monitoring

A Claude Skill for searching cheap Ryanair flights, with a future price monitoring feature.

---

## Requirements

- Node.js 18+
- Claude (Pro, Max, Team or Enterprise) with **code execution enabled**

---

## Skills

### 1. Ryanair Flight Search (`ryanair-skill`)

A Claude Custom Skill that lets you find the cheapest Ryanair flights in natural language.

#### Modes

| Mode | When it triggers | Script |
|---|---|---|
| **Single search** | One destination | `search-flights.mjs` |
| **Cheap travel** | Multiple destinations + budget | `cheap-travel.mjs` |

#### Single search — what you can say
> "Find me the cheapest Ryanair flight from Dublin to London next Saturday, 1 adult, morning flights only"

- Handles multi-airport cities (e.g. London → Gatwick / Luton / Stansted)
- Optional departure time window filter
- If no flights exist on the requested date, suggests the nearest available dates

#### Cheap travel — what you can say
> "I want to fly from Dublin to Barcelona, Madrid or Lisbon on 10 March returning 17 March, 2 adults, budget €200 each"

- Searches all destinations **in parallel**
- Silently skips destinations with no flights on those exact dates
- Returns results sorted cheapest first with booking links

#### Install the skill
1. Download `ryanair-skill.zip` from the [releases](https://github.com/samuelteixeiras/ryanair-monitoring/releases) or build it locally (see below)
2. Go to Claude.ai → **Skills** → **Upload Skill**
3. Upload the ZIP and enable it

#### Build the ZIP locally
```bash
zip -r ryanair-skill.zip ryanair-skill/
```

---

## Airport data

The skill uses a bundled airport list (`ryanair-skill/resources/airports.json`) instead of calling the Ryanair API on every lookup. This makes airport resolution instant and fully offline.

The list covers all 228 active Ryanair airports and rarely changes. To refresh it when Ryanair adds or removes airports:

```bash
node --input-type=module <<'EOF'
import { writeFileSync } from 'fs';
const res = await fetch('https://www.ryanair.com/api/views/locate/5/airports/en/active', {
  headers: { 'User-Agent': 'Mozilla/5.0' }
});
const data = await res.json();
writeFileSync(
  'ryanair-skill/resources/airports.json',
  JSON.stringify(
    data.map(a => ({ iataCode: a.code, name: a.name, city: a.city?.name ?? '', country: a.country?.name ?? '' })),
    null, 2
  )
);
console.log(`Saved ${data.length} airports`);
EOF
```

Then commit and push:
```bash
git add ryanair-skill/resources/airports.json
git commit -m "chore: refresh airport data"
git push
```

---

## Project structure

```
ryanair-monitoring/
├── ryanair-skill/
│   ├── Skill.md                  # Claude conversation flow & instructions
│   ├── resources/
│   │   └── airports.json         # Bundled airport data (228 airports)
│   └── scripts/
│       ├── package.json
│       ├── airports.mjs          # Airport lookup from local file
│       ├── search-flights.mjs    # Single destination search
│       └── cheap-travel.mjs      # Multi-destination budget search
├── resources/
│   └── Airports.postman_collection.json   # Ryanair API reference
└── Requirements.md
```

---

## Ryanair API reference

| Endpoint | Used for |
|---|---|
| `GET /api/views/locate/5/airports/en/active` | Refresh airport list |
| `GET /api/booking/v4/en-gb/availability?...` | Flight search (prices + times) |
| `GET /api/farfnd/v4/oneWayFares/{origin}/{destination}/availabilities` | Available dates for a route |

Full collection: `resources/Airports.postman_collection.json`


API Reference from: https://www.postman.com/hakkotsu/ryanair/overview