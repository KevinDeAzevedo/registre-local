import { setTimeout as sleep } from 'node:timers/promises';
import { geography } from './model.ts';
import type { Company } from './model.ts';

type Fields = Record<string, unknown>;
type Unit = Fields & { periodesUniteLegale?: Fields[] };
type Headquarters = Fields & { adresseEtablissement?: Fields };

export function publicText(value: unknown) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text && text !== '[ND]' ? text : null;
}

export function headquartersId(unit: Unit) {
  const siren = publicText(unit.siren);
  const nic = publicText(unit.periodesUniteLegale?.find(p => p.dateFin === null)?.nicSiegeUniteLegale);
  return siren && nic && /^\d{5}$/.test(nic) ? siren + nic : null;
}

export function normalize(unit: Unit, headquarters?: Headquarters): Company {
  const siren = publicText(unit.siren);
  const created = publicText(unit.dateCreationUniteLegale);
  const period = unit.periodesUniteLegale?.find(p => p.dateFin === null);
  if (!siren || !/^\d{9}$/.test(siren) || !created || !/^\d{4}-\d{2}-\d{2}$/.test(created) || !period) {
    throw new Error('Sirene a renvoyé une unité légale sans SIREN, date de création ou période courante valide.');
  }
  const legal = publicText(period.categorieJuridiqueUniteLegale);
  const fullUnit = unit.statutDiffusionUniteLegale === 'O';
  const fullSeat = headquarters?.statutDiffusionEtablissement === 'O';
  const expectedSeat = headquartersId(unit);
  const seatId = publicText(headquarters?.siret);
  const seat = seatId && seatId === expectedSeat && headquarters?.etablissementSiege === true ? headquarters : undefined;
  const commune_code = publicText(seat?.adresseEtablissement?.codeCommuneEtablissement);
  const entrepreneur = fullUnit && legal === '1000'
    ? [publicText(unit.prenomUsuelUniteLegale) ?? publicText(unit.prenom1UniteLegale),
        publicText(period.nomUsageUniteLegale) ?? publicText(period.nomUniteLegale)].filter(Boolean).join(' ') || null
    : null;
  const name = fullUnit || (unit.statutDiffusionUniteLegale === 'P' && legal && /^[3-9]/.test(legal))
    ? publicText(period.denominationUniteLegale) ?? publicText(period.denominationUsuelle1UniteLegale) ?? entrepreneur
    : null;
  return {
    siren, created, name, entrepreneur,
    commune_code, commune: publicText(seat?.adresseEtablissement?.libelleCommuneEtablissement),
    ...geography(commune_code),
    activity: publicText(period.activitePrincipaleUniteLegale),
    legal, regime: 'unknown', partial: Number(!fullUnit || Boolean(seat && !fullSeat)), siret: seat ? seatId : null,
  };
}

type SearchPage<T> = {
  header: { total: number; curseurSuivant?: string };
} & Partial<{ unitesLegales: T[]; etablissements: T[] }>;

export async function* fetchCompanies(from: string, until: string): AsyncGenerator<Company> {
  const key = process.env.SIRENE_API_KEY?.trim();
  if (!key) throw new Error('Clé Sirene manquante. Renseignez SIRENE_API_KEY dans .env.local.');
  let lastRequest = 0;

  async function* pages<T>(resource: 'siren' | 'siret', query: string) {
    const field = resource === 'siren' ? 'unitesLegales' : 'etablissements';
    const seen = new Set<string>();
    let cursor = '*';
    let received = 0;
    let expected: number | undefined;
    while (true) {
      await sleep(Math.max(0, 2100 - (Date.now() - lastRequest)));
      const params = new URLSearchParams({ q: query, nombre: '1000', curseur: cursor });
      lastRequest = Date.now();
      let response: Response;
      try {
        response = await fetch('https://api.insee.fr/api-sirene/3.11/' + resource + '?' + params, {
          headers: { 'X-INSEE-Api-Key-Integration': key! }, signal: AbortSignal.timeout(45000), cache: 'no-store',
        });
      } catch {
        throw new Error('Sirene est injoignable ou le délai de réponse est dépassé sur /' + resource + '. Vérifiez la connexion puis relancez.');
      }
      if (!response.ok) {
        if (response.status === 404 && cursor === '*') {
          const body = await response.json().catch(() => null);
          if (body?.header?.statut === 404) return;
        }
        const action = response.status === 401 || response.status === 403 ? 'Vérifiez la clé et la souscription sur le portail Insee.'
          : response.status === 429 ? 'Limite d’appels atteinte. Attendez au moins une minute puis relancez.'
          : 'Consultez l’état du service et relancez.';
        throw new Error(`Sirene /${resource} a répondu HTTP ${response.status}. ${action}`);
      }
      const result = await response.json() as SearchPage<T>;
      const records = result[field];
      if (!Number.isSafeInteger(result.header?.total) || !Array.isArray(records)) {
        throw new Error('Format inattendu dans la réponse Sirene /' + resource + '.');
      }
      const next = result.header.curseurSuivant;
      expected ??= result.header.total;
      received += records.length;
      if (expected !== result.header.total || received > expected) {
        throw new Error('Le nombre de résultats Sirene a changé pendant la pagination. Relancez la synchronisation.');
      }
      if (records.length) yield records;
      if (received === expected) return;
      if (!records.length || !next || next === cursor || seen.has(next)) throw new Error('Curseur Sirene manquant ou incohérent sur /' + resource + '.');
      seen.add(next);
      cursor = next;
    }
  }

  for await (const units of pages<Unit>('siren', `dateCreationUniteLegale:[${from} TO ${until}]`)) {
    const ids = [...new Set(units.map(headquartersId).filter((id): id is string => Boolean(id)))];
    const seats = new Map<string, Headquarters>();
    // Les lots courts gardent l’URL sous les limites des passerelles HTTP.
    for (let i = 0; i < ids.length; i += 100) {
      for await (const batch of pages<Headquarters>('siret', 'siret:(' + ids.slice(i, i + 100).join(' OR ') + ')')) {
        for (const seat of batch) {
          const id = publicText(seat.siret);
          if (id) seats.set(id, seat);
        }
      }
    }
    for (const unit of units) {
      const company = normalize(unit, seats.get(headquartersId(unit) ?? ''));
      if (company.created < from || company.created > until) throw new Error('Sirene a renvoyé une unité hors de la période demandée.');
      yield company;
    }
  }
}
