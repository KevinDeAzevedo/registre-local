import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { openDb } from '../lib/db.ts';
import { searchPlaces } from '../lib/places.ts';
import { synchronize } from '../lib/sync.ts';

test('Google Places à la demande, en démo puis avec une réponse simulée', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'registre-places-'));
  process.env.SQLITE_PATH = join(directory, 'registre.sqlite');
  process.env.APP_MODE = 'demo';
  const fetchMock = t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    assert.equal(url, 'https://places.googleapis.com/v1/places:searchText');
    assert.equal(init.method, 'POST');
    assert.equal(init.cache, 'no-store');
    assert.equal(new Headers(init.headers).get('X-Goog-Api-Key'), 'cle-de-test');
    assert.match(new Headers(init.headers).get('X-Goog-FieldMask') ?? '', /places.nationalPhoneNumber,places.websiteUri/);
    assert.equal(JSON.parse(String(init.body)).textQuery, 'Atelier fictif, Paris, 75, France');
    return Response.json({ places: [{
      displayName: { text: 'Atelier fictif' }, formattedAddress: 'Paris', nationalPhoneNumber: '01 99 00 00 00',
      websiteUri: 'https://atelier.example/',
    }] });
  });
  try {
    await synchronize();
    assert.equal((await searchPlaces('000000001'))[0].website, 'https://entreprise.example/');
    assert.equal(fetchMock.mock.callCount(), 0);
    process.env.APP_MODE = 'sirene';
    const db = openDb();
    try {
      db.exec(`INSERT INTO companies(siren,name,created,commune,department,regime,partial)
        VALUES ('000000001','Atelier fictif','2026-11-01','Paris','75','unknown',0),
               ('000000002','Nom masqué','2026-11-01','Paris','75','unknown',1)`);
      delete process.env.GOOGLE_PLACES_API_KEY;
      await assert.rejects(searchPlaces('000000001'), /GOOGLE_PLACES_API_KEY/);
      process.env.GOOGLE_PLACES_API_KEY = 'cle-de-test';
      await assert.rejects(searchPlaces('000000002'), /diffusion totale/);
      assert.equal((await searchPlaces('000000001'))[0].phone, '01 99 00 00 00');
      assert.equal(fetchMock.mock.callCount(), 1);
      assert.equal(db.prepare('SELECT * FROM contacts').get(), undefined);
    } finally { db.close(); }
  } finally { rmSync(directory, { recursive: true }); }
});
