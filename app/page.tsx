import Link from 'next/link';
import { choices, filterColumns, listCompanies, mode, openDb } from '../lib/db';
import type { Filters, FilterColumn } from '../lib/db';
import { activityLabels, formatDate, legalLabels, regions } from '../lib/model';
import { FilterForm, SyncForm } from './forms';

export const dynamic = 'force-dynamic';

const labels: Record<FilterColumn, string> = {
  region: 'Région', department: 'Département', commune_code: 'Commune', activity: 'Activité', legal: 'Forme juridique',
};

function optionLabel(column: FilterColumn, code: string, label: string | null) {
  if (column === 'region') return regions[code] ?? code;
  if (column === 'commune_code') return label ? `${label} (${code})` : code;
  const name = column === 'activity' ? activityLabels[code] : column === 'legal' ? legalLabels[code] : null;
  return name ? `${name} (${code})` : code;
}

export default async function Home({ searchParams }: { searchParams: Promise<Filters> }) {
  const filters = await searchParams;
  const db = openDb();
  const { result, options, status } = (() => {
    try {
      return {
        result: listCompanies(db, filters),
        options: filterColumns.map(column => ({ column, values: choices(db, column) })),
        status: db.prepare('SELECT succeeded, error, lease FROM sync_state WHERE id=1').get() as {
          succeeded: string | null; error: string | null; lease: number | null;
        },
      };
    } finally { db.close(); }
  })();
  const demo = mode() === 'demo';
  const date = status.succeeded ? new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Paris',
  }).format(new Date(status.succeeded)) : null;
  function pageLink(page: number) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) if (key !== 'page' && typeof value === 'string') query.set(key, value);
    query.set('page', String(page));
    return '/?' + query;
  }
  return <>
    <section className="hero">
      <div>
        <p className="eyebrow"><span className="dot" /> {demo ? 'Mode démo · Données fictives' : 'Répertoire Sirene · Insee'}</p>
        <h1>Créations d’entreprises</h1>
        <p className="intro">Explorez les entreprises récemment créées en France et leurs coordonnées professionnelles publiques.</p>
      </div>
      <div className="sync-box">
        <p className="sync-label">Dernière synchronisation réussie</p>
        <p className="sync-date">{date ?? 'Aucune synchronisation'}</p>
        {status.lease && status.lease > Date.now() ? <p className="muted">Synchronisation en cours…</p> : null}
        <SyncForm />
      </div>
    </section>
    {status.error && <p className="banner error" role="alert">Dernière tentative échouée. {status.error}</p>}
    <section className="panel filters" aria-labelledby="filtres">
      <h2 id="filtres">Filtres</h2>
      <FilterForm>
        <div className="filter-grid">
          <label>Période<select name="days" defaultValue={result.days}>
            <option value="7">7 derniers jours</option><option value="30">30 derniers jours</option>
            <option value="90">90 derniers jours</option><option value="all">Tout l’historique</option>
          </select></label>
          {options.map(({ column, values }) => {
            const selected = typeof filters[column] === 'string' ? filters[column] : '';
            return <label key={column}>{labels[column]}<select name={column} defaultValue={selected}>
              <option value="">Tout afficher</option>
              {selected && !values.some(v => v.code === selected) && <option value={selected}>{selected}</option>}
              {values.map(({ code, label }) => <option key={code} value={code}>{optionLabel(column, code, label)}</option>)}
            </select></label>;
          })}
        </div>
      </FilterForm>
    </section>
    <section aria-labelledby="resultats">
      <div className="results-head"><h2 id="resultats">{result.total.toLocaleString('fr-FR')} {result.total > 1 ? 'entreprises' : 'entreprise'}</h2>
        <span className="muted">Créations les plus récentes</span></div>
      {result.companies.length ? <div className="panel table-wrap"><table>
        <thead><tr><th scope="col">Entreprise / SIREN</th><th scope="col">Création</th><th scope="col">Commune du siège</th><th scope="col">Activité</th><th scope="col">Forme juridique</th></tr></thead>
        <tbody>{result.companies.map(c => <tr key={c.siren}>
          <td><Link href={'/entreprises/' + c.siren}>{c.name ?? 'Nom indisponible'} <span aria-hidden="true" className="arrow">↗</span></Link><small className="mono">{c.siren}</small></td>
          <td className="nowrap">{formatDate(c.created)}</td>
          <td>{c.commune ?? 'Indisponible'}{c.commune_code && <small className="mono">{c.commune_code}</small>}</td>
          <td>{c.activity ? activityLabels[c.activity] ?? c.activity : 'Indisponible'}{c.activity && activityLabels[c.activity] && <small className="mono">{c.activity}</small>}</td>
          <td>{c.legal ? <span className="tag">{legalLabels[c.legal] ?? c.legal}</span> : 'Indisponible'}</td>
        </tr>)}</tbody>
      </table></div> : <div className="panel empty"><h3>Aucune fiche à afficher</h3>
        <p>{date ? 'Modifiez les filtres pour élargir la recherche.' : 'Lancez une synchronisation pour importer les premières fiches.'}</p></div>}
      {result.pages > 1 && <nav className="pagination" aria-label="Pagination">
        {result.page > 1 && <Link href={pageLink(result.page - 1)}>← Précédente</Link>}
        <span>Page {result.page} sur {result.pages}</span>
        {result.page < result.pages && <Link href={pageLink(result.page + 1)}>Suivante →</Link>}
      </nav>}
    </section>
  </>;
}
