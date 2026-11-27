import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ContactForm, DeleteContact } from '../../forms';
import { PlacesForm } from '../../places-form';
import { mode, openDb } from '../../../lib/db';
import type { Contact } from '../../../lib/db';
import type { Company } from '../../../lib/model';
import { activityLabels, contactKinds, daysAgo, formatDate, legalLabels, regions } from '../../../lib/model';

export const dynamic = 'force-dynamic';

export default async function Detail({ params }: { params: Promise<{ siren: string }> }) {
  const { siren } = await params;
  if (!/^\d{9}$/.test(siren)) notFound();
  const db = openDb();
  const { c, contacts } = (() => {
    try {
      const c = db.prepare('SELECT * FROM companies WHERE siren=?').get(siren) as Company | undefined;
      const contacts = c?.partial === 0 ? db.prepare('SELECT * FROM contacts WHERE siren=? ORDER BY kind').all(siren) as Contact[] : [];
      return { c, contacts };
    } finally { db.close(); }
  })();
  if (!c) notFound();
  const demo = mode() === 'demo';
  const entries = [
    ['SIREN', c.siren],
    ['Création de l’unité légale', formatDate(c.created)],
    ['Commune du siège', [c.commune, c.commune_code].filter(Boolean).join(' · ')],
    ['Département', c.department],
    ['Région', c.region && (regions[c.region] ?? c.region)],
    ['SIRET du siège', c.siret],
    ['Activité principale', [c.activity && activityLabels[c.activity], c.activity].filter(Boolean).join(' · ')],
    ['Forme juridique', [c.legal && legalLabels[c.legal], c.legal].filter(Boolean).join(' · ')],
    ['Régime', c.regime === 'micro' ? (demo ? 'Micro-entrepreneur (exemple fictif)' : 'Micro-entrepreneur') : 'Régime inconnu'],
    [c.legal === '1000' ? 'Nom de l’entrepreneur' : 'Représentants légaux', c.entrepreneur],
  ];
  return <>
    <Link className="back" href="/">← Toutes les entreprises</Link>
    <section className="hero detail-hero"><div>
      <p className="eyebrow"><span className="dot" /> {demo ? 'Mode démo · Fiche fictive' : 'Répertoire Sirene · Insee'}</p>
      <h1>{c.name ?? 'Nom indisponible'}</h1><p className="intro mono">SIREN {siren}</p>
      {!!c.partial && <span className="tag partial">Diffusion partielle</span>}
    </div><a className="button outline" href={demo ? 'https://annuaire-entreprises.data.gouv.fr/' : `https://annuaire-entreprises.data.gouv.fr/entreprise/${siren}`} target="_blank" rel="noreferrer">Annuaire des Entreprises ↗</a></section>
    <section className="panel info" aria-labelledby="identite">
      <h2 id="identite">Identité de l’entreprise</h2>
      <dl>{entries.map(([label, value]) => <div key={label}><dt>{label}</dt><dd className={value ? '' : 'muted'}>{value || 'Indisponible'}</dd></div>)}</dl>
    </section>
    <section className="panel info" aria-labelledby="contacts">
      <h2 id="contacts">Coordonnées professionnelles</h2>
      {c.partial ? <p className="muted">Coordonnées indisponibles pour cette fiche en diffusion partielle.</p> : <>
        {contacts.length ? <ul className="contacts">{contacts.map(contact => <li key={contact.kind}>
          <div><strong>{contactKinds[contact.kind]}</strong><div className="contact-value">{contact.value}</div>
            <small><a href={contact.source} target="_blank" rel="noreferrer">Page officielle ↗</a> · Vérifiée le {formatDate(contact.verified)}</small></div>
          <DeleteContact siren={siren} kind={contact.kind} />
        </li>)}</ul> : <p className="muted">Aucune coordonnée disponible.</p>}
        {c.name && c.commune && <PlacesForm key={siren} siren={siren} demo={demo}
          configured={Boolean(process.env.GOOGLE_PLACES_API_KEY?.trim())} />}
        <h3>Ajouter ou mettre à jour une coordonnée</h3>
        <ContactForm siren={siren} today={daysAgo(0)} />
      </>}
    </section>
  </>;
}
