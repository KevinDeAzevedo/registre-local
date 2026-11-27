import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { contactKinds, daysAgo } from './model.ts';
import type { Company } from './model.ts';

export function mode() {
  const value = process.env.APP_MODE ?? 'demo';
  if (value !== 'demo' && value !== 'sirene') throw new Error('APP_MODE doit valoir demo ou sirene.');
  return value;
}

export function openDb() {
  const configuredPath = process.env.SQLITE_PATH;
  const basePath = configuredPath
    ? resolve(/*turbopackIgnore: true*/ configuredPath)
    : join(process.cwd(), 'data', 'registre.sqlite');
  const path = basePath + (mode() === 'demo' ? '.demo' : '');
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA busy_timeout=5000;
    PRAGMA journal_mode=WAL;
    PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS companies (
      siren TEXT PRIMARY KEY, name TEXT, entrepreneur TEXT, created TEXT NOT NULL,
      commune_code TEXT, commune TEXT, department TEXT, region TEXT, activity TEXT, legal TEXT,
      regime TEXT NOT NULL, partial INTEGER NOT NULL, siret TEXT
    ) STRICT;
    CREATE INDEX IF NOT EXISTS company_order ON companies(created DESC, siren);
    CREATE TABLE IF NOT EXISTS contacts (
      siren TEXT NOT NULL REFERENCES companies(siren) ON DELETE CASCADE,
      kind TEXT NOT NULL, value TEXT NOT NULL, source TEXT NOT NULL, verified TEXT NOT NULL,
      PRIMARY KEY(siren, kind)
    ) STRICT;
    CREATE TABLE IF NOT EXISTS sync_state (
      id INTEGER PRIMARY KEY CHECK(id=1), succeeded TEXT, error TEXT, owner TEXT, lease INTEGER
    ) STRICT;
    INSERT OR IGNORE INTO sync_state(id) VALUES(1);
  `);
  return db;
}

export type Filters = Record<string, string | string[] | undefined>;
export const filterColumns = ['region', 'department', 'commune_code', 'activity', 'legal'] as const;
export type FilterColumn = typeof filterColumns[number];

export function listCompanies(db: DatabaseSync, filters: Filters) {
  const days = ['7', '30', '90', 'all'].includes(String(filters.days)) ? String(filters.days) : '30';
  const clauses = ['created <= ?'];
  const values = [daysAgo(0)];
  if (days !== 'all') {
    clauses.push('created >= ?');
    values.push(daysAgo(Number(days) - 1));
  }
  for (const column of filterColumns) {
    const value = filters[column];
    if (typeof value === 'string' && value) {
      clauses.push(column + ' = ?');
      values.push(value);
    }
  }
  const where = ' WHERE ' + clauses.join(' AND ');
  const { total } = db.prepare('SELECT COUNT(*) AS total FROM companies' + where).get(...values) as { total: number };
  const size = 25;
  const pages = Math.max(1, Math.ceil(total / size));
  const page = Math.min(pages, Math.max(1, parseInt(String(filters.page), 10) || 1));
  const companies = db.prepare('SELECT * FROM companies' + where + ' ORDER BY created DESC, siren LIMIT ? OFFSET ?')
    .all(...values, size, (page - 1) * size) as Company[];
  return { companies, total, page, pages, days };
}

export function choices(db: DatabaseSync, column: FilterColumn) {
  const label = column === 'commune_code' ? 'MAX(commune)' : column;
  return db.prepare(`SELECT ${column} AS code, ${label} AS label FROM companies
    WHERE ${column} IS NOT NULL GROUP BY ${column} ORDER BY label COLLATE NOCASE, code`)
    .all() as { code: string; label: string | null }[];
}

export type Contact = { kind: keyof typeof contactKinds; value: string; source: string; verified: string };

function webUrl(input: string) {
  try {
    const url = new URL(input);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function saveContact(db: DatabaseSync, siren: string, form: FormData) {
  const kind = String(form.get('kind') ?? '');
  const value = String(form.get('value') ?? '').trim();
  const source = String(form.get('source') ?? '').trim();
  const verified = String(form.get('verified') ?? '');
  if (!Object.hasOwn(contactKinds, kind)) throw new Error('Choisissez un type de coordonnée.');
  if (form.get('intent') === 'delete') {
    db.prepare('DELETE FROM contacts WHERE siren=? AND kind=?').run(siren, kind);
    return;
  }
  if (source.length > 2048 || !webUrl(source) || form.get('public') !== 'on') {
    throw new Error('Indiquez une URL HTTP(S) et confirmez que la page officielle publie cette coordonnée professionnelle.');
  }
  const date = new Date(verified + 'T00:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(verified) || !Number.isFinite(+date) ||
      date.toISOString().slice(0, 10) !== verified || verified > daysAgo(0)) {
    throw new Error('Indiquez une date de vérification valide, au plus tard aujourd’hui.');
  }
  const valid = kind === 'email' ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    : kind === 'phone' ? /^\+?[\d .()-]{7,30}$/.test(value) && value.replace(/\D/g, '').length >= 7
    : webUrl(value);
  if (!valid || value.length > 2048) throw new Error('La valeur est invalide pour ce type de coordonnée.');
  const result = db.prepare(`INSERT INTO contacts (siren, kind, value, source, verified)
    SELECT siren, ?, ?, ?, ? FROM companies WHERE siren=? AND partial=0
    ON CONFLICT(siren, kind) DO UPDATE SET value=excluded.value, source=excluded.source, verified=excluded.verified`)
    .run(kind, value, source, verified, siren);
  if (!result.changes) throw new Error('La fiche est indisponible ou en diffusion partielle.');
}
