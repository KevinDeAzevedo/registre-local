import { mode, openDb } from './db.ts';

export type Place = {
  name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  maps: string | null;
  credits: { name: string; url: string | null }[];
};

function httpUrl(value: unknown) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

type GooglePlace = {
  displayName?: { text?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  attributions?: { provider: string; providerUri?: string }[];
};

export async function searchPlaces(siren: string): Promise<Place[]> {
  if (!/^\d{9}$/.test(siren)) throw new Error('SIREN invalide.');
  const db = openDb();
  const company = (() => {
    try {
      return db.prepare('SELECT name, commune, department, partial FROM companies WHERE siren=?').get(siren);
    } finally { db.close(); }
  })();
  if (company?.partial !== 0 || typeof company.name !== 'string' || !company.name ||
      typeof company.commune !== 'string' || !company.commune) {
    throw new Error('La recherche nécessite un nom et une commune publics sur une fiche en diffusion totale.');
  }
  if (mode() === 'demo') return [{
    name: company.name, address: `1 rue de l’Exemple, ${company.commune}`, phone: '01 99 00 00 00',
    website: 'https://entreprise.example/', maps: null, credits: [],
  }];
  const key = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!key) throw new Error('Renseigne GOOGLE_PLACES_API_KEY dans .env.local puis redémarre l’application.');
  const textQuery = [company.name, company.commune, company.department, 'France'].filter(Boolean).join(', ');
  let response: Response;
  try {
    response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.googleMapsUri,places.attributions',
      },
      body: JSON.stringify({ textQuery, languageCode: 'fr', regionCode: 'FR', pageSize: 3 }),
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    throw new Error('Google Places est injoignable. Vérifie la connexion puis relance la recherche.');
  }
  if (response.status === 429) throw new Error('Quota Google Places atteint. Vérifie les quotas du projet Google Cloud.');
  if ([400, 401, 403].includes(response.status)) {
    throw new Error(`Google Places a répondu HTTP ${response.status}. Vérifie la clé, ses restrictions, Places API (New) et la facturation.`);
  }
  if (!response.ok) throw new Error(`Google Places a répondu HTTP ${response.status}. Réessaie plus tard.`);
  const data = await response.json().catch(() => null) as { places?: GooglePlace[] } | null;
  if (!data || (data.places !== undefined && !Array.isArray(data.places))) throw new Error('Réponse Google Places inattendue.');
  return (data.places ?? []).slice(0, 3).flatMap(place => {
    const name = place?.displayName?.text;
    if (!name) return [];
    return [{
      name, address: place.formattedAddress ?? null, phone: place.nationalPhoneNumber ?? null,
      website: httpUrl(place.websiteUri), maps: httpUrl(place.googleMapsUri),
      credits: (place.attributions ?? []).filter(item => item.provider).map(item => ({
        name: item.provider, url: httpUrl(item.providerUri),
      })),
    }];
  });
}
