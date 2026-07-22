// --- Stallion Express (multi-carrier rates) ---

const STALLION_BASE = process.env.STALLION_SANDBOX === 'true'
  ? 'https://sandbox.stallion.ca/api/v5'
  : 'https://ship.stallion.ca/api/v5';
const STALLION_RATE_URL = `${STALLION_BASE}/rates`;

function getStallionToken() {
  return process.env.STALLION_API_TOKEN || null;
}

function getOriginPostal() {
  return (process.env.STALLION_ORIGIN_POSTAL || process.env.CANADAPOST_ORIGIN_POSTAL || 'M5V1A1').replace(/\s/g, '');
}

export function isConfigured() {
  return !!getStallionToken();
}

// --- Address validation ---

export async function validateAddress(address) {
  return formatValidation(address);
}

function formatValidation(address) {
  const errors = [];
  if (!address.line1?.trim()) errors.push('Street address is required');
  if (!address.city?.trim()) errors.push('City is required');
  if (!address.state?.trim()) errors.push('Province/state is required');
  if (!address.zip?.trim()) errors.push('Postal/ZIP code is required');

  const country = (address.country || 'CA').toUpperCase();
  if (country === 'CA') {
    if (address.zip && !/^[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$/.test(address.zip.trim())) {
      errors.push('Invalid Canadian postal code (format: A1A 1A1)');
    }
  } else if (country === 'US') {
    if (address.zip && !/^\d{5}(-\d{4})?$/.test(address.zip.trim())) {
      errors.push('Invalid US ZIP code');
    }
  }

  return { valid: errors.length === 0, errors, suggested: null, candidates: [] };
}

// --- Shipping rates ---

const PROCESSING_DAYS = 5;

export const TRACKED_RATES = {
  M: { priceCents: 2000, description: 'Local courier — Toronto', days: 6 },
  L: { priceCents: 1499, description: 'Canada Post Expedited — Ontario', days: 7 },
  K: { priceCents: 1499, description: 'Canada Post Expedited — Ontario', days: 8 },
  N: { priceCents: 1499, description: 'Canada Post Expedited — Ontario', days: 8 },
  P: { priceCents: 1699, description: 'Canada Post Expedited — Northern Ontario', days: 9 },
  H: { priceCents: 1499, description: 'Canada Post Expedited — Quebec', days: 7 },
  J: { priceCents: 1499, description: 'Canada Post Expedited — Quebec', days: 7 },
  G: { priceCents: 1699, description: 'Canada Post Expedited — Quebec', days: 8 },
};
export const TRACKED_DEFAULT = { priceCents: 2399, description: 'Canada Post Expedited Parcel', days: 10 };

function getLetterMailTransit(destPostalCode) {
  const fsa = (destPostalCode || '').replace(/\s/g, '').charAt(0).toUpperCase();
  if (fsa === 'M') return 2;
  if ('KLNP'.includes(fsa)) return 3;
  if ('HJG'.includes(fsa)) return 3;
  return 4;
}

const FSA_TO_PROVINCE = {
  A: 'NL', B: 'NS', C: 'PE', E: 'NB',
  G: 'QC', H: 'QC', J: 'QC',
  K: 'ON', L: 'ON', M: 'ON', N: 'ON', P: 'ON',
  R: 'MB', S: 'SK', T: 'AB',
  V: 'BC', X: 'NT', Y: 'YT',
};

async function fetchStallionRates(destPostalCode, destCountry) {
  const token = getStallionToken();
  if (!token) return null;

  const country = (destCountry || 'CA').toUpperCase();
  const dest = destPostalCode.replace(/\s/g, '').toUpperCase();
  const fsa = dest.charAt(0);

  const body = {
    type: 'regular',
    from_address: {
      postal_code: getOriginPostal(),
      country_code: 'CA',
    },
    to_address: {
      name: 'Customer',
      address1: '123 Main St',
      city: 'Destination',
      province_code: FSA_TO_PROVINCE[fsa] || 'ON',
      postal_code: dest,
      country_code: country,
      is_residential: true,
    },
    packages: [{
      weight: 0.1,
      weight_unit: 'kg',
      length: 20,
      width: 15,
      height: 2,
      size_unit: 'cm',
    }],
    items: [{
      title: 'Custom stickers',
      quantity: 1,
      value: 10,
      currency: 'CAD',
    }],
  };

  try {
    const res = await fetch(STALLION_RATE_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      console.error('Stallion rate error:', res.status);
      return null;
    }

    const data = await res.json();
    const rates = (data.data || [])
      .filter(r => r.trackable)
      .sort((a, b) => a.total - b.total)
      .slice(0, 3)
      .map(r => ({
        service: `stallion.${r.service}`,
        carrier: r.carrier,
        serviceName: r.service_name,
        priceCents: Math.round(r.total * 100),
        currency: (r.currency || 'CAD').toLowerCase(),
        deliveryDays: r.estimated_delivery_days || null,
      }));

    return rates.length > 0 ? rates : null;
  } catch (err) {
    console.error('Stallion rate fetch error:', err.message);
    return null;
  }
}

const ratesCache = new Map();
const RATES_CACHE_TTL = 10 * 60_000;

export function getCachedRate(destPostalCode, destCountry, serviceName) {
  const cacheKey = `${(destPostalCode || '').replace(/\s/g, '').toUpperCase()}_${(destCountry || 'CA').toUpperCase()}`;
  const cached = ratesCache.get(cacheKey);
  if (!cached || Date.now() > cached.expiresAt) return null;
  return cached.data.rates?.find(r => r.service === serviceName) || null;
}

export async function getShippingRates(destPostalCode, destCountry) {
  const country = (destCountry || 'CA').toUpperCase();
  const cacheKey = `${(destPostalCode || '').replace(/\s/g, '').toUpperCase()}_${country}`;
  const cached = ratesCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) return cached.data;

  const domestic = country === 'CA';

  if (domestic) {
    const fsa = (destPostalCode || '').replace(/\s/g, '').charAt(0).toUpperCase();
    const transit = getLetterMailTransit(destPostalCode);
    const totalDays = PROCESSING_DAYS + transit;
    const zone = TRACKED_RATES[fsa] || TRACKED_DEFAULT;

    const lettermail = {
      service: 'Standard Shipping',
      description: 'Canada Post Lettermail — no tracking',
      serviceCode: null,
      carrier: 'Canada Post',
      priceCents: 199,
      currency: 'cad',
      deliveryDate: estimateDate(totalDays),
      deliveryDateLate: estimateDate(totalDays + 2),
      deliveryDays: totalDays,
    };

    const fallbackTracked = {
      service: 'Tracked Shipping',
      description: zone.description,
      carrier: 'Canada Post',
      priceCents: zone.priceCents,
      currency: 'cad',
      deliveryDate: estimateDate(PROCESSING_DAYS + zone.days),
      deliveryDateLate: estimateDate(PROCESSING_DAYS + zone.days + 2),
      deliveryDays: PROCESSING_DAYS + zone.days,
    };

    const stallionRates = await fetchStallionRates(destPostalCode, 'CA');
    let trackedOptions;
    let source;

    if (stallionRates) {
      trackedOptions = stallionRates.map(r => ({
        service: r.service,
        description: `${r.carrier} — ${r.serviceName}`,
        carrier: r.carrier,
        priceCents: r.priceCents,
        currency: r.currency,
        deliveryDate: r.deliveryDays ? estimateDate(PROCESSING_DAYS + r.deliveryDays) : null,
        deliveryDateLate: r.deliveryDays ? estimateDate(PROCESSING_DAYS + r.deliveryDays + 2) : null,
        deliveryDays: r.deliveryDays ? PROCESSING_DAYS + r.deliveryDays : null,
      }));
      source = 'stallion';
    } else {
      trackedOptions = [fallbackTracked];
      source = 'estimate';
    }

    const domesticResult = { source, rates: [lettermail, ...trackedOptions] };
    ratesCache.set(cacheKey, { data: domesticResult, expiresAt: Date.now() + RATES_CACHE_TTL });
    return domesticResult;
  }

  const stallionRates = await fetchStallionRates(destPostalCode, country);
  let intlResult;

  if (stallionRates) {
    intlResult = {
      source: 'stallion',
      rates: stallionRates.map(r => ({
        service: r.service,
        description: `${r.carrier} — ${r.serviceName}`,
        carrier: r.carrier,
        priceCents: r.priceCents,
        currency: r.currency,
        deliveryDate: r.deliveryDays ? estimateDate(PROCESSING_DAYS + r.deliveryDays) : null,
        deliveryDateLate: r.deliveryDays ? estimateDate(PROCESSING_DAYS + r.deliveryDays + 2) : null,
        deliveryDays: r.deliveryDays ? PROCESSING_DAYS + r.deliveryDays : null,
      })),
    };
  } else {
    intlResult = {
      source: 'estimate',
      rates: [{
        service: 'International Shipping',
        description: country === 'US' ? 'Tracked Packet — USA' : 'International Parcel',
        carrier: 'Canada Post',
        priceCents: country === 'US' ? 1499 : 1999,
        currency: 'cad',
        deliveryDate: estimateDate(country === 'US' ? 10 : 15),
        deliveryDateLate: estimateDate(country === 'US' ? 15 : 25),
        deliveryDays: country === 'US' ? 10 : 15,
      }],
    };
  }

  ratesCache.set(cacheKey, { data: intlResult, expiresAt: Date.now() + RATES_CACHE_TTL });
  return intlResult;
}

function estimateDate(daysFromNow) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split('T')[0];
}
