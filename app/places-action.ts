'use server';

import { searchPlaces } from '../lib/places';
import type { Place } from '../lib/places';

export type PlacesState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'success'; places: Place[] };

export async function placesAction(siren: string): Promise<PlacesState> {
  try {
    return { status: 'success', places: await searchPlaces(siren) };
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? error.message : 'La recherche a échoué.' };
  }
}
