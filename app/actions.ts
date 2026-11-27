'use server';

import { revalidatePath } from 'next/cache';
import { synchronize } from '../lib/sync';
import { openDb, saveContact } from '../lib/db';

export type ActionState = { message: string; error: boolean };

export async function syncAction(): Promise<ActionState> {
  try {
    const count = await synchronize();
    revalidatePath('/');
    revalidatePath('/entreprises/[siren]', 'page');
    return { message: `Synchronisation réussie · ${count.toLocaleString('fr-FR')} fiches.`, error: false };
  } catch (error) {
    revalidatePath('/');
    return { message: error instanceof Error ? error.message : 'La synchronisation a échoué.', error: true };
  }
}

export async function contactAction(siren: string, _previous: ActionState, form: FormData): Promise<ActionState> {
  try {
    if (!/^\d{9}$/.test(siren)) throw new Error('SIREN invalide.');
    const db = openDb();
    try { saveContact(db, siren, form); } finally { db.close(); }
    revalidatePath('/entreprises/' + siren);
    return { message: form.get('intent') === 'delete' ? 'Coordonnée supprimée.' : 'Coordonnée enregistrée.', error: false };
  } catch (error) {
    return { message: error instanceof Error ? error.message : 'Impossible d’enregistrer la coordonnée.', error: true };
  }
}
