// Rules Engine - Weighted keyword matching for CLIENT, PRESCRIBER, SUPPLIER
// This runs FIRST to avoid unnecessary AI costs

import { Category, NormalizedContact, ClassificationResult } from '../_shared/types.ts';

// Keyword dictionaries with weights (FR + EN)
const CLIENT_KEYWORDS = {
  high: [
    'client', 'customer', 'acheteur', 'buyer', 'consommateur', 'consumer',
    'particulier', 'individual', 'patient direct', 'end user'
  ],
  medium: [
    'commande', 'order', 'achat', 'purchase', 'facture client', 'invoice',
    'vente', 'sale', 'retail', 'détail'
  ],
  low: [
    'contact', 'demande', 'request', 'inquiry', 'renseignement'
  ]
};

const PRESCRIBER_KEYWORDS = {
  high: [
    'médecin', 'doctor', 'dr', 'docteur', 'prescripteur', 'prescriber',
    'praticien', 'practitioner', 'clinique', 'clinic', 'cabinet médical',
    'hôpital', 'hospital', 'pharmacien', 'pharmacist', 'dentiste', 'dentist',
    'vétérinaire', 'veterinarian', 'infirmier', 'nurse', 'kiné', 'physiotherapist'
  ],
  medium: [
    'santé', 'health', 'médical', 'medical', 'soin', 'care', 'thérapie',
    'therapy', 'diagnostic', 'traitement', 'treatment', 'ordonnance', 'prescription'
  ],
  low: [
    'professionnel santé', 'health professional', 'spécialiste', 'specialist'
  ]
};

const SUPPLIER_KEYWORDS = {
  high: [
    'fournisseur', 'supplier', 'vendeur', 'vendor', 'distributeur', 'distributor',
    'grossiste', 'wholesaler', 'fabricant', 'manufacturer', 'producteur', 'producer',
    'importateur', 'importer', 'exportateur', 'exporter'
  ],
  medium: [
    'livraison', 'delivery', 'approvisionnement', 'supply', 'stock', 'inventory',
    'commande fournisseur', 'purchase order', 'b2b', 'commerce', 'trade'
  ],
  low: [
    'partenaire', 'partner', 'prestataire', 'service provider', 'sous-traitant', 'subcontractor'
  ]
};

const WEIGHTS = {
  high: 10,
  medium: 5,
  low: 2
};

interface CategoryScore {
  category: Category;
  score: number;
  signals: string[];
}

export function classifyByRules(contact: NormalizedContact, language: 'en' | 'fr' = 'en'): ClassificationResult | null {
  const scores: CategoryScore[] = [
    { category: 'CLIENT', score: 0, signals: [] },
    { category: 'PRESCRIBER', score: 0, signals: [] },
    { category: 'SUPPLIER', score: 0, signals: [] },
  ];

  // Combine searchable text
  const searchText = [
    contact.nom_complet,
    contact.activites,
    contact.etiquettes,
    contact.vendeur,
  ].filter(Boolean).join(' ').toLowerCase();

  // Score CLIENT
  scoreCategory(searchText, CLIENT_KEYWORDS, scores[0]);

  // Score PRESCRIBER
  scoreCategory(searchText, PRESCRIBER_KEYWORDS, scores[1]);

  // Score SUPPLIER
  scoreCategory(searchText, SUPPLIER_KEYWORDS, scores[2]);

  // Sort by score
  scores.sort((a, b) => b.score - a.score);

  const topScore = scores[0].score;
  const secondScore = scores[1]?.score || 0;
  const margin = topScore - secondScore;

  // Calculate confidence based on score and margin
  const maxPossibleScore = WEIGHTS.high * 3; // Assume max 3 high-weight matches
  const confidence = Math.min(100, Math.round((topScore / maxPossibleScore) * 100));

  // Check if we meet the thresholds for rules-based classification
  const RULE_ACCEPT_THRESHOLD = parseInt(Deno.env.get('RULE_ACCEPT_THRESHOLD') || '80');
  const RULE_MARGIN_THRESHOLD = parseInt(Deno.env.get('RULE_MARGIN_THRESHOLD') || '15');

  if (confidence >= RULE_ACCEPT_THRESHOLD && margin >= RULE_MARGIN_THRESHOLD && topScore > 0) {
    const reason = language === 'fr'
      ? `Classification par règles: ${scores[0].signals.slice(0, 3).join(', ')}`
      : `Rules-based classification: ${scores[0].signals.slice(0, 3).join(', ')}`;

    return {
      final_category: scores[0].category,
      confidence,
      reason,
      public_signals_used: scores[0].signals.slice(0, 5).join('; '),
      needs_review: confidence < 90,
    };
  }

  // Not confident enough - return null to trigger enrichment/AI
  return null;
}

function scoreCategory(
  text: string,
  keywords: { high: string[]; medium: string[]; low: string[] },
  result: CategoryScore
): void {
  // Check high-weight keywords
  for (const keyword of keywords.high) {
    if (text.includes(keyword.toLowerCase())) {
      result.score += WEIGHTS.high;
      result.signals.push(keyword);
    }
  }

  // Check medium-weight keywords
  for (const keyword of keywords.medium) {
    if (text.includes(keyword.toLowerCase())) {
      result.score += WEIGHTS.medium;
      result.signals.push(keyword);
    }
  }

  // Check low-weight keywords
  for (const keyword of keywords.low) {
    if (text.includes(keyword.toLowerCase())) {
      result.score += WEIGHTS.low;
      result.signals.push(keyword);
    }
  }
}

// Additional heuristics based on field patterns
export function applyFieldHeuristics(contact: NormalizedContact): Partial<CategoryScore> | null {
  // Check for medical-related patterns in email/domain
  const email = contact.email?.toLowerCase() || '';
  const domain = email.split('@')[1] || '';

  if (domain.includes('clinic') || domain.includes('hospital') || domain.includes('medical') ||
      domain.includes('pharma') || domain.includes('sante') || domain.includes('health')) {
    return {
      category: 'PRESCRIBER',
      score: WEIGHTS.high,
      signals: ['Medical domain detected']
    };
  }

  // Check for supplier patterns
  if (domain.includes('supplier') || domain.includes('wholesale') || domain.includes('distribution') ||
      domain.includes('fournisseur') || domain.includes('grossiste')) {
    return {
      category: 'SUPPLIER',
      score: WEIGHTS.high,
      signals: ['Supplier domain detected']
    };
  }

  // Check TVA number (suppliers often have this)
  if (contact.n_tva && contact.n_tva.trim().length > 5) {
    return {
      category: 'SUPPLIER',
      score: WEIGHTS.medium,
      signals: ['VAT number present']
    };
  }

  return null;
}
