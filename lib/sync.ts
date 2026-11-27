import { randomUUID } from 'node:crypto';
import { mode, openDb } from './db.ts';
import { demoCompanies } from './demo.ts';
import { daysAgo } from './model.ts';
import type { Company } from './model.ts';
import { fetchCompanies } from './sirene.ts';

export async function synchronize() {
  const db = openDb();
  const owner = randomUUID();
  const leaseDuration = 180_000;
  const renew = db.prepare('UPDATE sync_state SET lease=? WHERE owner=?');
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  try {
    const locked = db.prepare('UPDATE sync_state SET owner=?, lease=? WHERE owner IS NULL OR lease < ?')
      .run(owner, Date.now() + leaseDuration, Date.now());
    if (!locked.changes) throw new Error('Une synchronisation est déjà en cours.');
    heartbeat = setInterval(() => {
      try { renew.run(Date.now() + leaseDuration, owner); } catch { /* Réessai au prochain battement. */ }
    }, 30_000);
    const demo = mode() === 'demo';
    const now = new Date();
    const { earliest, latest } = db.prepare('SELECT MIN(created) AS earliest, MAX(created) AS latest FROM companies').get() as {
      earliest: string | null; latest: string | null;
    };
    const windowStart = daysAgo(29, now);
    const from = earliest && earliest < windowStart ? earliest : windowStart;
    const incoming = new Map<string, Company>();
    for await (const company of demo
      ? demoCompanies(latest ? new Date(latest + 'T12:00:00Z') : now)
      : fetchCompanies(from, daysAgo(0, now))) {
      if (incoming.has(company.siren)) {
        throw new Error('Un SIREN apparaît plusieurs fois dans la pagination. Relancez la synchronisation après la mise à jour de l’Insee.');
      }
      incoming.set(company.siren, company);
    }

    db.exec('BEGIN IMMEDIATE');
    try {
      if (!renew.run(Date.now() + leaseDuration, owner).changes) throw new Error('La réservation de la synchronisation a expiré. Relancez.');
      db.exec('CREATE TEMP TABLE imported(siren TEXT PRIMARY KEY) WITHOUT ROWID');
      const mark = db.prepare('INSERT INTO imported VALUES(?)');
      const save = db.prepare(`INSERT INTO companies VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(siren) DO UPDATE SET name=excluded.name, entrepreneur=excluded.entrepreneur,
        created=excluded.created, commune_code=excluded.commune_code, commune=excluded.commune,
        department=excluded.department, region=excluded.region, activity=excluded.activity, legal=excluded.legal,
        regime=excluded.regime, partial=excluded.partial, siret=excluded.siret`);
      const removeContacts = db.prepare('DELETE FROM contacts WHERE siren=?');
      for (const c of incoming.values()) {
        mark.run(c.siren);
        save.run(c.siren, c.name, c.entrepreneur, c.created, c.commune_code, c.commune, c.department,
          c.region, c.activity, c.legal, c.regime, c.partial, c.siret);
        if (c.partial) removeContacts.run(c.siren);
      }
      // Une unité qui n’est plus renvoyée par la recherche complète ne doit plus être affichée.
      db.exec('DELETE FROM companies WHERE siren NOT IN (SELECT siren FROM imported)');
      db.prepare('UPDATE sync_state SET succeeded=?, error=NULL, owner=NULL, lease=NULL WHERE owner=?')
        .run(new Date().toISOString(), owner);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    return incoming.size;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur imprévue pendant la synchronisation.';
    db.prepare('UPDATE sync_state SET error=?, owner=NULL, lease=NULL WHERE owner=?').run(message, owner);
    throw error;
  } finally {
    clearInterval(heartbeat);
    db.close();
  }
}
