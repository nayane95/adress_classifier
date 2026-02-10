// CSV Schema Constants - FIXED 25 columns
export const EXPECTED_COLUMNS = [
  'Avatar 128',
  'Nom complet',
  'N° TVA',
  'Prochain avis',
  'Activation',
  'Partner Level',
  'Envoi de la facture',
  'format eInvoice',
  'E-mail',
  'Téléphone',
  'Vendeur',
  'Activités',
  'Rue',
  'Ville',
  'État',
  'Pays',
  'Stats',
  'Étiquettes',
  'Responsable',
  'Rappels',
  'Statut de la relance',
  'Prochain rappel',
  'Niveau de relance',
  'Montant dû',
  'Total en retard',
] as const;

export const COLUMN_COUNT = 25;

// Categories
export type Category = 'CLIENT' | 'PRESCRIBER' | 'SUPPLIER' | 'A_QUALIFIER';

export const CATEGORIES: Category[] = ['CLIENT', 'PRESCRIBER', 'SUPPLIER', 'A_QUALIFIER'];

// Classification method
export type ClassificationMethod = 'RULES' | 'AI' | 'HYBRID';

// Processing steps
export type ProcessingStep = 'PARSE' | 'RULES' | 'ENRICH' | 'AI' | 'EXPORT';

// Row status
export type RowStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

// Enrichment status
export type EnrichmentStatus = 'SEARCHING' | 'CLASSIFYING' | 'DONE' | 'FAILED';

// Job status
export type JobStatus = 'PENDING' | 'PARSING' | 'RULES' | 'ENRICHING' | 'AI_CLASSIFYING' | 'COMPLETED' | 'FAILED';

// Normalized contact row
export interface NormalizedContact {
  avatar?: string;
  nom_complet: string;
  n_tva?: string;
  prochain_avis?: string;
  activation?: string;
  partner_level?: string;
  envoi_facture?: string;
  format_einvoice?: string;
  email?: string;
  telephone?: string;
  vendeur?: string;
  activites?: string;
  rue?: string;
  ville?: string;
  etat?: string;
  pays?: string;
  stats?: string;
  etiquettes?: string;
  responsable?: string;
  rappels?: string;
  statut_relance?: string;
  prochain_rappel?: string;
  niveau_relance?: string;
  montant_du?: string;
  total_retard?: string;
}

// Classification result
export interface ClassificationResult {
  final_category: Category;
  confidence: number;
  reason: string;
  public_signals_used: string;
  needs_review: boolean;
}

// Enrichment data
export interface EnrichmentData {
  domain?: string;
  business_type?: string;
  categories?: string[];
  website_title?: string;
  website_description?: string;
  search_snippets?: string[];
  maps_categories?: string[];
  signals_summary?: string;
}

// Configuration
export interface Config {
  RULE_ACCEPT_THRESHOLD: number;
  RULE_MARGIN_THRESHOLD: number;
  AI_ACCEPT_THRESHOLD: number;
  MAX_AI_ROWS_PERCENT: number;
  MAX_SEARCH_CALLS_PER_JOB: number;
  MAX_AI_TOKENS_PER_JOB: number;
  ENRICHMENT_CACHE_TTL_DAYS: number;
  AI_CACHE_TTL_DAYS: number;
}

export const DEFAULT_CONFIG: Config = {
  RULE_ACCEPT_THRESHOLD: 80,
  RULE_MARGIN_THRESHOLD: 15,
  AI_ACCEPT_THRESHOLD: 70,
  MAX_AI_ROWS_PERCENT: 60,
  MAX_SEARCH_CALLS_PER_JOB: 500,
  MAX_AI_TOKENS_PER_JOB: 1000000,
  ENRICHMENT_CACHE_TTL_DAYS: 30,
  AI_CACHE_TTL_DAYS: 90,
};

// Utility functions
export function normalizeContact(row: Record<string, string>): NormalizedContact {
  return {
    avatar: row['Avatar 128'] || undefined,
    nom_complet: row['Nom complet'] || '',
    n_tva: row['N° TVA'] || undefined,
    prochain_avis: row['Prochain avis'] || undefined,
    activation: row['Activation'] || undefined,
    partner_level: row['Partner Level'] || undefined,
    envoi_facture: row['Envoi de la facture'] || undefined,
    format_einvoice: row['format eInvoice'] || undefined,
    email: row['E-mail'] || undefined,
    telephone: row['Téléphone'] || undefined,
    vendeur: row['Vendeur'] || undefined,
    activites: row['Activités'] || undefined,
    rue: row['Rue'] || undefined,
    ville: row['Ville'] || undefined,
    etat: row['État'] || undefined,
    pays: row['Pays'] || undefined,
    stats: row['Stats'] || undefined,
    etiquettes: row['Étiquettes'] || undefined,
    responsable: row['Responsable'] || undefined,
    rappels: row['Rappels'] || undefined,
    statut_relance: row['Statut de la relance'] || undefined,
    prochain_rappel: row['Prochain rappel'] || undefined,
    niveau_relance: row['Niveau de relance'] || undefined,
    montant_du: row['Montant dû'] || undefined,
    total_retard: row['Total en retard'] || undefined,
  };
}

export function getEmailDomain(email?: string): string | undefined {
  if (!email) return undefined;
  const match = email.match(/@(.+)$/);
  return match ? match[1].toLowerCase() : undefined;
}

export function createCacheKey(contact: NormalizedContact): string {
  const domain = getEmailDomain(contact.email);
  const name = contact.nom_complet.toLowerCase().trim();
  const city = contact.ville?.toLowerCase().trim() || '';
  const country = contact.pays?.toLowerCase().trim() || '';
  
  return `${domain || name}:${city}:${country}`;
}

export function createAIInputHash(input: string): string {
  // Simple hash function for caching
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
}
