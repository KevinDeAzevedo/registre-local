import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { listCompanies, openDb, saveContact } from '../lib/db.ts';
import { daysAgo } from '../lib/model.ts';
import { normalize } from '../lib/sirene.ts';
import { synchronize } from '../lib/sync.ts';

function contactForm() {
  const form = new FormData();
  form.set('kind', 'email');
  form.set('value', 'contact@example.test');
  form.set('source', 'https://example.test/contact');
  form.set('verified', daysAgo(0));
  form.set('public', 'on');
  return form;
}

test('deux imports démo, filtres combinés et coordonnées persistantes', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'registre-demo-'));
  process.env.SQLITE_PATH = join(dir, 'registre.sqlite');
  process.env.APP_MODE = 'demo';
  try {
    assert.equal(await synchronize(), 12);
    let db = openDb();
    try {
      saveContact(db, '000000009', contactForm());
      assert.throws(() => saveContact(db, '000000011', contactForm()), /diffusion partielle/);
    } finally { db.close(); }

    assert.equal(await synchronize(), 12);
    db = openDb();
    try {
      const all = listCompanies(db, { days: 'all' });
      assert.equal(all.total, 12);
      assert.equal(new Set(all.companies.map(c => c.siren)).size, 12);
      assert.deepEqual(all.companies.map(c => c.created), all.companies.map(c => c.created).sort().reverse());
      assert.equal(listCompanies(db, {}).total, 11);
      assert.equal(listCompanies(db, { days: '7' }).total, 4);
      assert.deepEqual(listCompanies(db, {
        days: '30', region: '04', department: '974', commune_code: '97411', activity: '62.01Z', legal: '1000',
      }).companies.map(c => c.siren), ['000000009']);
      assert.equal(listCompanies(db, { region: '04', commune_code: '93066' }).total, 0);
      const contact = db.prepare('SELECT value, source, verified FROM contacts WHERE siren=?').get('000000009');
      assert.equal(contact?.value, 'contact@example.test');
      assert.equal(contact?.source, 'https://example.test/contact');
      assert.equal(contact?.verified, daysAgo(0));
      assert.ok(db.prepare('SELECT succeeded FROM sync_state').get()?.succeeded);
    } finally { db.close(); }
  } finally { rmSync(dir, { recursive: true }); }
});

test('échec Sirene sans perte puis retrait de données lors du passage en diffusion partielle', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'registre-sirene-'));
  process.env.SQLITE_PATH = join(dir, 'registre.sqlite');
  process.env.APP_MODE = 'sirene';
  process.env.SIRENE_API_KEY = 'clé-fictive';
  const siren = '123456789';
  const unit = {
    siren, dateCreationUniteLegale: daysAgo(8), statutDiffusionUniteLegale: 'O',
    prenom1UniteLegale: 'Prénom fictif',
    periodesUniteLegale: [{ dateFin: null, nomUniteLegale: 'Nom fictif', nicSiegeUniteLegale: '00010',
      categorieJuridiqueUniteLegale: '1000', activitePrincipaleUniteLegale: '62.01Z' }],
  };
  const seat = {
    siret: siren + '00010', etablissementSiege: true, statutDiffusionEtablissement: 'O',
    dateCreationEtablissement: daysAgo(0),
    adresseEtablissement: { codeCommuneEtablissement: '35238', libelleCommuneEtablissement: 'Rennes' },
  };
  assert.equal(normalize(unit, { ...seat, etablissementSiege: false }).commune, null);
  assert.equal(normalize(unit, seat).created, unit.dateCreationUniteLegale);
  let stage: 'public' | 'failed' | 'partial' = 'public';
  const mocked = t.mock.method(globalThis, 'fetch', async (input: string, init: RequestInit) => {
    const url = new URL(input);
    assert.equal(new Headers(init.headers).get('X-INSEE-Api-Key-Integration'), 'clé-fictive');
    assert.equal(url.searchParams.get('curseur'), '*');
    if (stage === 'failed') return new Response(null, { status: 503 });
    if (url.pathname.endsWith('/siren')) {
      assert.match(url.searchParams.get('q') ?? '', /^dateCreationUniteLegale:\[/);
      return Response.json({ header: { total: 1 }, unitesLegales: [
        stage === 'partial' ? { ...unit, statutDiffusionUniteLegale: 'P' } : unit,
      ] });
    }
    assert.equal(url.searchParams.get('q'), 'siret:(12345678900010)');
    return Response.json({ header: { total: 1 }, etablissements: [stage === 'partial'
      ? { ...seat, statutDiffusionEtablissement: 'P', adresseEtablissement: {
          codeCommuneEtablissement: '[ND]', libelleCommuneEtablissement: '[ND]',
        } }
      : seat] });
  });
  const db = openDb();
  try {
    assert.equal(await synchronize(), 1);
    const previous = db.prepare('SELECT succeeded FROM sync_state').get()?.succeeded;
    assert.equal(listCompanies(db, {}).companies[0].entrepreneur, 'Prénom fictif Nom fictif');
    saveContact(db, siren, contactForm());
    stage = 'failed';
    await assert.rejects(synchronize(), /HTTP 503/);
    assert.equal(listCompanies(db, {}).total, 1);
    assert.equal(db.prepare('SELECT succeeded FROM sync_state').get()?.succeeded, previous);
    assert.match(String(db.prepare('SELECT error FROM sync_state').get()?.error), /HTTP 503/);
    stage = 'partial';
    assert.equal(await synchronize(), 1);
    const [updated] = listCompanies(db, {}).companies;
    assert.equal(updated.name, null);
    assert.equal(updated.entrepreneur, null);
    assert.equal(updated.commune, null);
    assert.equal(updated.commune_code, null);
    assert.equal(updated.regime, 'unknown');
    assert.equal(db.prepare('SELECT value FROM contacts').get(), undefined);
    assert.equal(db.prepare('SELECT error FROM sync_state').get()?.error, null);
    assert.equal(mocked.mock.callCount(), 5);
  } finally {
    db.close();
    rmSync(dir, { recursive: true });
  }
});
