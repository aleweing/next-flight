// ─── Next Flight · Cloudflare Worker (SerpApi · Google Flights) ───────
// Despliega en: https://dash.cloudflare.com → Workers & Pages → Create Worker
//
// Variable de entorno (Settings → Variables → Environment Variables):
//   SERPAPI_KEY  → tu API key de serpapi.com
//
// Documentación: https://serpapi.com/google-flights-api
// Plan gratuito: 250 búsquedas/mes

const SERPAPI_ENDPOINT = 'https://serpapi.com/search';

// ─── CORS headers ─────────────────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// ─── Entry point ──────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(request.url);

    if (url.pathname === '/search') {
      return handleSearch(url.searchParams, env);
    }

    return new Response(JSON.stringify({ error: 'Ruta no encontrada' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  },
};

// ─── GET /search ──────────────────────────────────────────────────────
async function handleSearch(params, env) {
  try {
    const origin      = params.get('origin')      || 'MAD';
    const destination = params.get('destination') || 'EZE';
    const dateFrom    = params.get('dateFrom');       // yyyy-mm-dd
    const dateTo      = params.get('dateTo');         // yyyy-mm-dd (vuelta)
    const adults      = parseInt(params.get('adults') || '1');
    const maxPrice    = params.get('maxPrice') ? parseFloat(params.get('maxPrice')) : null;
    const airline     = params.get('airline')  || null;
    const nonStop     = params.get('nonStop') === 'true';
    const cabin       = params.get('cabin')    || 'ECONOMY';

    if (!dateFrom) return jsonError('dateFrom es obligatorio', 400);

    // Mapear cabina → número SerpApi (1=Economy, 2=PremEco, 3=Business, 4=First)
    const cabinMap = { ECONOMY: 1, PREMIUM_ECONOMY: 2, BUSINESS: 3, FIRST: 4 };
    const travelClass = cabinMap[cabin] || 1;

    // Tipo de vuelo: 1=roundtrip, 2=oneway
    const tripType = dateTo ? 1 : 2;

    const q = new URLSearchParams({
      engine:         'google_flights',
      api_key:        env.SERPAPI_KEY,
      departure_id:   origin,
      arrival_id:     destination,
      outbound_date:  dateFrom,          // yyyy-mm-dd
      currency:       'EUR',
      hl:             'es',
      gl:             'es',
      type:           String(tripType),
      adults:         String(adults),
      travel_class:   String(travelClass),
    });

    if (dateTo)  q.set('return_date', dateTo);
    if (nonStop) q.set('stops', '0');    // 0 = nonstop only

    const res  = await fetch(`${SERPAPI_ENDPOINT}?${q}`);
    const data = await res.json();

    if (!res.ok || data.error) {
      return jsonError(data.error || `SerpApi error ${res.status}`, res.status);
    }

    // SerpApi devuelve best_flights y other_flights
    const raw = [
      ...(data.best_flights   || []),
      ...(data.other_flights  || []),
    ];

    // Filtros post-respuesta
    let offers = raw.map(f => normalizeOffer(f));

    // Filtro precio máximo
    if (maxPrice) {
      offers = offers.filter(o => parseFloat(o.price.total) <= maxPrice);
    }

    // Filtro aerolínea
    if (airline) {
      offers = offers.filter(o =>
        o.itineraries[0].segments.some(s => s.carrierCode === airline)
      );
    }

    return new Response(JSON.stringify({ offers }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });

  } catch (err) {
    return jsonError(err.message, 500);
  }
}

// ─── Normalizar oferta SerpApi → formato interno del frontend ─────────
//
// SerpApi devuelve cada opción como:
// {
//   flights: [ { departure_airport, arrival_airport, duration, airline,
//                flight_number, travel_class, ... }, ... ],
//   layovers: [ { duration, name, id } ],
//   total_duration: number (minutos),
//   price: number,
//   type: "Nonstop" | "1 stop" | ...,
//   airline_logo: url,
//   booking_token: string   ← necesario para deep link
// }
function normalizeOffer(flight) {
  const segments = (flight.flights || []).map(seg => ({
    departure: {
      iataCode: seg.departure_airport?.id   || '',
      at:       seg.departure_airport?.time || '',   // "2026-08-15 10:30"
    },
    arrival: {
      iataCode: seg.arrival_airport?.id   || '',
      at:       seg.arrival_airport?.time || '',
    },
    carrierCode:  iataFromName(seg.airline),
    airlineName:  seg.airline      || '',
    airlineLogo:  seg.airline_logo || '',
    number:       seg.flight_number || '',
    duration:     seg.duration      || 0,   // minutos
    travelClass:  seg.travel_class  || 'Economy',
    airplane:     seg.airplane      || '',
  }));

  const totalMin = flight.total_duration || 0;
  const durIso   = `PT${Math.floor(totalMin / 60)}H${totalMin % 60}M`;

  // Deep link a Google Flights con el vuelo preseleccionado
  const bookingToken = flight.booking_token || null;
  const firstSeg     = segments[0] || {};
  const lastSeg      = segments[segments.length - 1] || {};
  const depDate      = (firstSeg.departure?.at || '').split(' ')[0];

  let deepLink = 'https://www.google.com/flights';
  if (bookingToken) {
    deepLink = `https://www.google.com/flights?hl=es#flt=${firstSeg.departure?.iataCode}.${lastSeg.arrival?.iataCode}.${depDate};bkn=${bookingToken}`;
  }

  return {
    id:    flight.booking_token || String(Math.random()),
    price: {
      total:    String(flight.price || 0),
      currency: 'EUR',
    },
    itineraries: [{
      duration: durIso,
      segments,
    }],
    // travelerPricings para cabina — usamos el del primer segmento
    travelerPricings: [{
      fareDetailsBySegment: [{
        cabin: serpCabinToInternal(segments[0]?.travelClass),
      }],
    }],
    validatingAirlineCodes: [segments[0]?.carrierCode || ''],
    deepLink,
    // Extra info útil para el frontend
    isBestFlight: flight.type === 'Nonstop' || false,
    stops:        flight.flights ? flight.flights.length - 1 : 0,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────

// SerpApi devuelve el nombre completo de la aerolínea, no el código IATA.
// Mapeamos los más comunes para la ruta ESP↔ARG.
const AIRLINE_CODES = {
  'Iberia':                  'IB',
  'Air Europa':              'UX',
  'LATAM Airlines':          'LA',
  'LATAM':                   'LA',
  'Aerolíneas Argentinas':   'AR',
  'Aerolineas Argentinas':   'AR',
  'Swiss':                   'LX',
  'Swiss International Air Lines': 'LX',
  'Air France':              'AF',
  'KLM':                     'KL',
  'Lufthansa':               'LH',
  'British Airways':         'BA',
  'Vueling':                 'VY',
  'ITA Airways':             'AZ',
  'Turkish Airlines':        'TK',
  'Emirates':                'EK',
  'Qatar Airways':           'QR',
  'American Airlines':       'AA',
  'United Airlines':         'UA',
  'Delta Air Lines':         'DL',
  'Avianca':                 'AV',
  'Copa Airlines':           'CM',
};

function iataFromName(name) {
  if (!name) return '';
  return AIRLINE_CODES[name] || name.slice(0, 2).toUpperCase();
}

function serpCabinToInternal(cabin) {
  const map = {
    'Economy':         'ECONOMY',
    'Premium economy': 'PREMIUM_ECONOMY',
    'Business':        'BUSINESS',
    'First':           'FIRST',
  };
  return map[cabin] || 'ECONOMY';
}

function jsonError(msg, status = 500) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
