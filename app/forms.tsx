'use client';

import { useActionState, useTransition } from 'react';
import type { FormEvent, ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { contactAction, syncAction } from './actions';
import type { ActionState } from './actions';
import { contactKinds } from '../lib/model';

const initial: ActionState = { message: '', error: false };

export function SyncForm() {
  const [state, action, pending] = useActionState(syncAction, initial);
  return <form action={action} className="sync-form">
    <button className="button" disabled={pending} aria-busy={pending}>
      {pending ? <span className="button-spinner" aria-hidden="true" /> : <span aria-hidden="true">↻</span>}
      {pending ? 'Synchronisation en cours…' : 'Synchroniser'}
    </button>
    {state.error && <p className="error" role="alert">{state.message}</p>}
    {!state.error && state.message && <span className="sr-only" role="status">{state.message}</span>}
  </form>;
}

export function FilterForm({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const query = new URLSearchParams();
    for (const [name, value] of new FormData(event.currentTarget)) {
      if (typeof value === 'string') query.append(name, value);
    }
    startTransition(() => router.push('/?' + query.toString()));
  }

  return <form method="get" action="/" onSubmit={applyFilters}>
    {children}
    <div className="filter-actions">
      <button className="button" disabled={pending} aria-busy={pending}>
        {pending && <span className="button-spinner" aria-hidden="true" />}
        {pending ? 'Application des filtres…' : 'Appliquer les filtres'}
      </button>
      <Link href="/">Réinitialiser</Link>
    </div>
  </form>;
}

export function ContactForm({ siren, today }: { siren: string; today: string }) {
  const [state, action, pending] = useActionState(contactAction.bind(null, siren), initial);
  return <form action={action} className="contact-form">
    <div className="contact-fields">
      <label>Type<select name="kind">{Object.entries(contactKinds).map(([kind, label]) =>
        <option key={kind} value={kind}>{label}</option>)}</select></label>
      <label>Coordonnée<input name="value" required maxLength={2048} /></label>
      <label>URL de la page officielle<input name="source" type="url" required maxLength={2048} placeholder="https://…" /></label>
      <label>Date de vérification<input name="verified" type="date" defaultValue={today} max={today} required /></label>
    </div>
    <label className="check"><input type="checkbox" name="public" required /> La page officielle de l’entreprise publie cette coordonnée professionnelle.</label>
    <button className="button" disabled={pending}>{pending ? 'Enregistrement…' : 'Enregistrer'}</button>
    {state.message && <p className={state.error ? 'error' : 'success'} role={state.error ? 'alert' : 'status'}>{state.message}</p>}
  </form>;
}

export function DeleteContact({ siren, kind }: { siren: string; kind: string }) {
  const [state, action, pending] = useActionState(contactAction.bind(null, siren), initial);
  return <form action={action}>
    <input type="hidden" name="kind" value={kind} />
    <button className="text-button" name="intent" value="delete" disabled={pending}>Supprimer</button>
    {state.error && <p className="error" role="alert">{state.message}</p>}
  </form>;
}
