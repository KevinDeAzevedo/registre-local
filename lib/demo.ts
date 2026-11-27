import { daysAgo, geography } from './model.ts';
import type { Company } from './model.ts';

const examples = [
  ['Atelier Orée', '75056', 'Paris', '74.10Z', '5720'],
  ['Le Comptoir des Dunes', '33063', 'Bordeaux', '47.91B', '5710'],
  ['Studio Mésange', '35238', 'Rennes', '62.01Z', '1000'],
  ['Maison Églantine', '69123', 'Lyon', '96.02A', '5499'],
  ['Bureau des Rives', '31555', 'Toulouse', '70.22Z', '5710'],
  ['La Table des Aulnes', '44109', 'Nantes', '56.10C', '5499'],
  ['Cadran & Papier', '08391', 'Saint-Laurent', '74.10Z', '1000'],
  ['Chemin des Vignes', '22299', 'Saint-Laurent', '47.91B', '5720'],
  ['Épure Horizon', '97411', 'Saint-Denis', '62.01Z', '1000'],
  ['Jardin Minéral', '93066', 'Saint-Denis', '70.22Z', '5720'],
  ['Sillon Bleu', '13055', 'Marseille', '74.10Z', '1000'],
  ['Halte du Verger', '67482', 'Strasbourg', '56.10C', '5499'],
];

export function demoCompanies(anchor: Date): Company[] {
  return examples.map(([name, commune_code, commune, activity, legal], index) => ({
    siren: String(index + 1).padStart(9, '0'),
    name: index === 10 ? null : name,
    entrepreneur: index === 2 ? 'Camille Verne (nom fictif)' : null,
    created: daysAgo(index === 11 ? 41 : index * 2, anchor),
    commune_code, commune, ...geography(commune_code), activity, legal,
    regime: index === 2 ? 'micro' : 'unknown', partial: Number(index === 10), siret: null,
  }));
}
