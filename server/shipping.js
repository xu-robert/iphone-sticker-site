import { SHIPPING_FLAT_CENTS } from './pricing.js';

// --- Shippo (address validation) ---

const SHIPPO_BASE = 'https://api.goshippo.com';

function getShippoToken() {
  return process.env.SHIPPO_API_TOKEN || null;
}

// --- Canada Post (Expedited Parcel rates) ---

const CP_TOKEN_URL = 'https://api.canadapost-postescanada.ca/prod/devportal-portaildesdeveloppeurs/cpc-api-native-oauth-provider/oauth2/token';
const CP_RATE_URL = 'https://api.canadapost-postescanada.ca/prod/devportal-portaildesdeveloppeurs/rating/v1/prices';

let cpTokenCache = { token: null, expiresAt: 0 };

async function getCPAuth() {
  const clientId = process.env.CANADAPOST_API_KEY;
  const clientSecret = process.env.CANADAPOST_API_SECRET;
  if (!clientId || !clientSecret) return null;

  if (cpTokenCache.token && Date.now() < cpTokenCache.expiresAt) {
    return cpTokenCache.token;
  }

  try {
    const res = await fetch(CP_TOKEN_URL, {
      method: 'POST',
      headers: {
        'X-IBM-Client-Id': clientId,
        'X-IBM-Client-Secret': clientSecret,
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'scope=merchant&grant_type=client_credentials',
    });

    if (!res.ok) {
      console.error('Canada Post OAuth error:', res.status);
      return null;
    }

    const data = await res.json();
    cpTokenCache.token = data.access_token;
    cpTokenCache.expiresAt = Date.now() + (data.expires_in - 60) * 1000;
    return data.access_token;
  } catch (err) {
    console.error('Canada Post OAuth fetch error:', err.message);
    return null;
  }
}

function getCPCustomerNumber() {
  return process.env.CANADAPOST_CUSTOMER_NUMBER || null;
}

function getCPOriginPostal() {
  return (process.env.CANADAPOST_ORIGIN_POSTAL || 'M5V1A1').replace(/\s/g, '');
}

export function isConfigured() {
  const key = process.env.CANADAPOST_API_KEY;
  const secret = process.env.CANADAPOST_API_SECRET;
  return !!getShippoToken() || !!(key && secret);
}

// --- Address validation ---

export async function validateAddress(address) {
  const token = getShippoToken();
  if (!token) {
    return formatValidation(address);
  }

  try {
    const res = await fetch(`${SHIPPO_BASE}/addresses`, {
      method: 'POST',
      headers: {
        'Authorization': `ShippoToken ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: address.name || 'Recipient',
        street1: address.line1,
        street2: address.line2 || '',
        city: address.city,
        state: address.state,
        zip: address.zip,
        country: address.country || 'CA',
        validate: true,
      }),
    });

    if (!res.ok) return formatValidation(address);

    const data = await res.json();
    if (data.validation_results?.is_valid) {
      return {
        valid: true, errors: [],
        suggested: {
          line1: data.street1 || address.line1,
          line2: data.street2 || address.line2 || '',
          city: data.city || address.city,
          state: data.state || address.state,
          zip: data.zip || address.zip,
          country: data.country || address.country || 'CA',
        },
        candidates: [],
      };
    }

    const messages = data.validation_results?.messages || [];
    return {
      valid: false,
      errors: messages.length > 0 ? messages.map(m => m.text) : ['Address could not be validated'],
      suggested: null, candidates: [],
    };
  } catch (err) {
    console.error('Shippo address validation error:', err.message);
    return formatValidation(address);
  }
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

const ONTARIO_FSA = new Set(['K', 'L', 'M', 'N', 'P']);
const PROCESSING_DAYS = 5;

function getLetterMailTransit(destPostalCode) {
  const fsa = (destPostalCode || '').replace(/\s/g, '').charAt(0).toUpperCase();
  if (fsa === 'M') return 2;
  if (ONTARIO_FSA.has(fsa)) return 3;
  return 4;
}

async function fetchCPExpeditedRate(destPostalCode) {
  const token = await getCPAuth();
  if (!token) return null;

  const origin = getCPOriginPostal();
  const dest = destPostalCode.replace(/\s/g, '').toUpperCase();

  const body = {
    customerNumber: getCPCustomerNumber() || undefined,
    quoteType: getCPCustomerNumber() ? 'commercial' : 'counter',
    parcelCharacteristics: {
      weight: 0.1,
      dimensions: { length: 20, width: 15, height: 2 },
    },
    services: ['DOM.EP'],
    originPostalCode: origin,
    destination: { domestic: { postalCode: dest } },
  };

  try {
    const res = await fetch(CP_RATE_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Language': 'en-CA',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.error('Canada Post rate error:', res.status);
      return null;
    }

    const data = await res.json();
    const quote = Array.isArray(data) ? data.find(q => q.serviceCode === 'DOM.EP') || data[0] : data;
    if (!quote) return null;

    return {
      priceCents: Math.round(parseFloat(quote.priceDetails?.due) * 100),
      deliveryDate: quote.serviceStandard?.expectedDeliveryDate || null,
      deliveryDays: parseInt(quote.serviceStandard?.expectedTransitTime) || null,
    };
  } catch (err) {
    console.error('Canada Post rate fetch error:', err.message);
    return null;
  }
}

const ratesCache = new Map();
const RATES_CACHE_TTL = 10 * 60_000;

export async function getShippingRates(destPostalCode, destCountry) {
  const country = (destCountry || 'CA').toUpperCase();
  const cacheKey = `${(destPostalCode || '').replace(/\s/g, '').toUpperCase()}_${country}`;
  const cached = ratesCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) return cached.data;

  const domestic = country === 'CA';

  if (domestic) {
    const transit = getLetterMailTransit(destPostalCode);
    const totalDays = PROCESSING_DAYS + transit;
    const isLocal = transit === 2;

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

    let tracked;
    if (isLocal) {
      tracked = {
        service: 'Tracked Shipping',
        description: 'Same-day courier — local Toronto',
        serviceCode: null,
        carrier: 'Local Courier',
        priceCents: 2000,
        currency: 'cad',
        deliveryDate: estimateDate(6),
        deliveryDateLate: estimateDate(7),
        deliveryDays: 6,
      };
    } else {
      const cpRate = await fetchCPExpeditedRate(destPostalCode);
      if (cpRate) {
        const days = PROCESSING_DAYS + (cpRate.deliveryDays || 7);
        tracked = {
          service: 'Tracked Shipping',
          description: 'Canada Post Expedited Parcel',
          serviceCode: 'DOM.EP',
          carrier: 'Canada Post',
          priceCents: cpRate.priceCents,
          currency: 'cad',
          deliveryDate: cpRate.deliveryDate || estimateDate(days),
          deliveryDateLate: estimateDate(days + 2),
          deliveryDays: days,
        };
      } else {
        tracked = {
          service: 'Tracked Shipping',
          description: 'Canada Post Tracked Packet',
          serviceCode: null,
          carrier: 'Canada Post',
          priceCents: 2299,
          currency: 'cad',
          deliveryDate: estimateDate(12),
          deliveryDateLate: estimateDate(14),
          deliveryDays: 12,
        };
      }
    }

    const domesticResult = { source: tracked.serviceCode ? 'canadapost' : 'estimate', rates: [lettermail, tracked] };
    ratesCache.set(cacheKey, { data: domesticResult, expiresAt: Date.now() + RATES_CACHE_TTL });
    return domesticResult;
  }

  const intlResult = {
    source: 'estimate',
    rates: [{
      service: 'International Shipping',
      description: country === 'US' ? 'Canada Post Tracked Packet — USA' : 'Canada Post International',
      serviceCode: null,
      carrier: 'Canada Post',
      priceCents: country === 'US' ? 1499 : 1999,
      currency: 'cad',
      deliveryDate: estimateDate(country === 'US' ? 10 : 15),
      deliveryDateLate: estimateDate(country === 'US' ? 15 : 25),
      deliveryDays: country === 'US' ? 10 : 15,
    }],
  };
  ratesCache.set(cacheKey, { data: intlResult, expiresAt: Date.now() + RATES_CACHE_TTL });
  return intlResult;
}

function estimateDate(daysFromNow) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split('T')[0];
}
