export type Company = {
  siren: string;
  name: string | null;
  entrepreneur: string | null;
  created: string;
  commune_code: string | null;
  commune: string | null;
  department: string | null;
  region: string | null;
  activity: string | null;
  legal: string | null;
  regime: 'micro' | 'unknown';
  partial: number;
  siret: string | null;
};

export const regions: Record<string, string> = {
  '01': 'Guadeloupe', '02': 'Martinique', '03': 'Guyane', '04': 'La Réunion', '06': 'Mayotte',
  '11': 'Île-de-France', '24': 'Centre-Val de Loire', '27': 'Bourgogne-Franche-Comté',
  '28': 'Normandie', '32': 'Hauts-de-France', '44': 'Grand Est', '52': 'Pays de la Loire',
  '53': 'Bretagne', '75': 'Nouvelle-Aquitaine', '76': 'Occitanie',
  '84': 'Auvergne-Rhône-Alpes', '93': 'Provence-Alpes-Côte d’Azur', '94': 'Corse',
};

const regionDepartments: Record<string, string> = {
  '01': '971', '02': '972', '03': '973', '04': '974', '06': '976',
  '11': '75 77 78 91 92 93 94 95', '24': '18 28 36 37 41 45', '27': '21 25 39 58 70 71 89 90',
  '28': '14 27 50 61 76', '32': '02 59 60 62 80', '44': '08 10 51 52 54 55 57 67 68 88',
  '52': '44 49 53 72 85', '53': '22 29 35 56', '75': '16 17 19 23 24 33 40 47 64 79 86 87',
  '76': '09 11 12 30 31 32 34 46 48 65 66 81 82', '84': '01 03 07 15 26 38 42 43 63 69 73 74',
  '93': '04 05 06 13 83 84', '94': '2A 2B',
};

export function geography(code: string | null) {
  if (!code) return { department: null, region: null };
  const department = /^(97|98)/.test(code) ? code.slice(0, 3) : code.slice(0, 2);
  const region = Object.entries(regionDepartments).find(([, list]) => list.split(' ').includes(department))?.[0];
  return { department: region ? department : null, region: region ?? null };
}

export const legalLabels: Record<string, string> = {
  '1000': 'Entreprise individuelle', '5499': 'SARL', '5510': 'SA à conseil d’administration',
  '5710': 'SAS', '5720': 'SASU', '6540': 'SCI',
};

export const activityLabels: Record<string, string> = {
  '47.91B': 'Vente à distance spécialisée', '62.01Z': 'Programmation informatique',
  '70.22Z': 'Conseil pour les affaires', '74.10Z': 'Design',
  '56.10C': 'Restauration de type rapide', '96.02A': 'Coiffure',
};

export const contactKinds = {
  website: 'Site web', form: 'Formulaire de contact', email: 'Email professionnel', phone: 'Téléphone professionnel',
};

export function daysAgo(days: number, now = new Date()) {
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris' }).format(now);
  const date = new Date(today + 'T00:00:00Z');
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeZone: 'Europe/Paris' }).format(new Date(value));
}

