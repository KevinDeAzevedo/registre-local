import type { Metadata } from 'next';
import Link from 'next/link';
import './style.css';

export const metadata: Metadata = {
  title: 'Registre local · Créations d’entreprises',
  description: 'Consulter les créations d’entreprises en France et leurs coordonnées professionnelles publiques.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="fr"><body>
    <a className="skip" href="#contenu">Aller au contenu</a>
    <header className="top"><div className="wrap top-inner">
      <Link className="brand" href="/"><span className="mark" aria-hidden="true"><i/><i/><i/><i/></span> Registre local</Link>
      <span className="top-note">Créations d’entreprises · France</span>
    </div></header>
    <main className="wrap" id="contenu">{children}</main>
    <footer className="wrap footer">Registre local <span>Source officielle · Répertoire Sirene, Insee</span></footer>
  </body></html>;
}
