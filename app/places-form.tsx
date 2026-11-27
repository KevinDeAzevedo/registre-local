'use client';

import { useActionState } from 'react';
import { placesAction } from './places-action';
import type { PlacesState } from './places-action';

const initial: PlacesState = { status: 'idle' };

export function PlacesForm({ siren, demo, configured }: { siren: string; demo: boolean; configured: boolean }) {
  const [state, action, pending] = useActionState(placesAction.bind(null, siren), initial);
  return <div className="places">
    <h3>Recherche Google Maps</h3>
    {configured || demo ? <form action={action}>
      <p className="muted">{demo
        ? 'Teste la recherche avec un résultat fictif.'
        : 'Le nom et la commune sont envoyés à Google à chaque recherche. Vérifie que le résultat correspond à la bonne entreprise.'}</p>
      <button className="button outline" disabled={pending}>{pending ? 'Recherche en cours…' : 'Rechercher sur Google Maps'}</button>
    </form> : <p className="muted">Ajoute GOOGLE_PLACES_API_KEY dans .env.local puis redémarre l’application pour activer la recherche.</p>}
    {state.status === 'error' && !pending && <p className="error" role="alert">{state.message}</p>}
    {state.status === 'success' && !pending && <div className="places-results" aria-live="polite">
      <p className="places-credit" translate="no">{demo ? 'Résultats fictifs' : 'Google Maps'}</p>
      {state.places.length === 0 ? <p>Aucun établissement trouvé.</p> : <ul className="contacts">
        {state.places.map((place, i) => <li key={i}><div>
          <strong>{place.name}</strong>
          <div>{place.address ?? 'Adresse indisponible'}</div>
          <div>{place.phone ?? 'Téléphone indisponible'}</div>
          <div>{place.website ? <a href={place.website} target="_blank" rel="noreferrer">Voir le site ↗</a> : 'Site indisponible'}</div>
          {place.maps && <div><a href={place.maps} target="_blank" rel="noreferrer">Voir sur Google Maps ↗</a></div>}
          {place.credits.map((credit, index) => <small key={index}>{credit.url
            ? <a href={credit.url} target="_blank" rel="noreferrer">{credit.name}</a>
            : credit.name} </small>)}
        </div></li>)}
      </ul>}
    </div>}
    {!demo && <p className="places-legal"><a href="https://policies.google.com/terms" target="_blank" rel="noreferrer">Conditions Google</a> · <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Confidentialité Google</a></p>}
  </div>;
}
