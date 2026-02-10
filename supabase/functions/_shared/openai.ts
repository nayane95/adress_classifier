// OpenAI helper - Structured outputs for classification
import { Category, ClassificationResult } from './types.ts';

export interface AIClassificationRequest {
  contacts: Array<{
    index: number;
    nom_complet: string;
    activites?: string;
    email?: string;
    ville?: string;
    pays?: string;
    enrichment_summary?: string;
  }>;
  language: 'en' | 'fr';
}

export interface AIClassificationResponse {
  results: Array<{
    index: number;
    final_category: Category;
    confidence: number;
    reason: string;
    public_signals_used: string;
    needs_review: boolean;
  }>;
  model_used: string;
  tokens_used?: number;
  system_prompt?: string;
  user_prompt?: string;
  raw_response?: string;
}

export async function classifyWithAI(
  request: AIClassificationRequest,
  usePrimaryModel: boolean = true
): Promise<AIClassificationResponse> {
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }

  const model = usePrimaryModel
    ? Deno.env.get('OPENAI_MODEL_PRIMARY') || 'gpt-4o-mini'
    : Deno.env.get('OPENAI_MODEL_SECONDARY') || 'gpt-4o';

  const systemPrompt = getSystemPrompt(request.language);
  const userPrompt = buildPrompt(request);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'contact_classification',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                results: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      index: { type: 'number' },
                      final_category: {
                        type: 'string',
                        enum: ['CLIENT', 'PRESCRIBER', 'SUPPLIER', 'A_QUALIFIER'],
                      },
                      confidence: { type: 'number' },
                      reason: { type: 'string' },
                      public_signals_used: { type: 'string' },
                      needs_review: { type: 'boolean' },
                    },
                    required: ['index', 'final_category', 'confidence', 'reason', 'public_signals_used', 'needs_review'],
                    additionalProperties: false,
                  },
                },
              },
              required: ['results'],
              additionalProperties: false,
            },
          },
        },
        temperature: 0.1, // Low temperature for deterministic results
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const content = JSON.parse(data.choices[0].message.content);

    return {
      results: content.results,
      model_used: model,
      tokens_used: data.usage?.total_tokens,
      system_prompt: systemPrompt,
      user_prompt: userPrompt,
      raw_response: JSON.stringify(content, null, 2),
    };
  } catch (error) {
    console.error('OpenAI classification error:', error);
    throw error;
  }
}

function getSystemPrompt(language: 'en' | 'fr'): string {
  if (language === 'fr') {
    return `Vous êtes un expert en classification de contacts professionnels. Votre tâche est d'analyser les informations fournies (nom, email, activités et surtout les signaux d'enrichissement web) pour classer chaque contact dans l'une de ces catégories :

- CLIENT : Particuliers, clients finaux, consommateurs, patients (si contact direct).
- PRESCRIBER : Professionnels de santé (médecins, dentistes, etc.), cliniques, hôpitaux, pharmacies, ou toute entité qui recommande des services de santé.
- SUPPLIER : Fournisseurs de produits ou services, grossistes, fabricants, distributeurs B2B.

CONSIGNES CRUCIALES :
1. ANALYSE PROFONDE : Ne dites pas "Informations insuffisantes" si vous pouvez faire une déduction raisonnable basée sur le nom de l'entreprise ou les snippets de recherche.
2. SIGNES D'ENRICHISSEMENT : Les données d'enrichissement (snippets web, titres de sites) sont votre source de vérité la plus forte. Analysez-les attentivement.
3. RAISONNEMENT HUMAIN : La 'reason' doit expliquer POURQUOI vous avez choisi cette catégorie (ex: "Le site web mentionne la vente en gros de matériel médical" ou "Snippet de recherche indique une clinique dentaire à Paris").
4. ÉVITEZ A_QUALIFIER : Utilisez A_QUALIFIER uniquement en cas d'absence totale d'informations exploitables.
5. CONFIANCE : Soyez précis. Si une entité est clairement une clinique, la confiance doit être de 90%+.`;
  }

  return `You are an expert at classifying professional contacts for a business database. Your goal is to use provided data (name, email, activities, and web enrichment signals) to categorize contacts accurately.

CATEGORIES:
- CLIENT: End consumers, direct patients, individual buyers.
- PRESCRIBER: Doctors, dentists, medical specialists, clinics, hospitals, pharmacies, or entities that prescribe/refer healthcare services.
- SUPPLIER: Product/service providers, wholesalers, manufacturers, B2B distributors.

CRITICAL INSTRUCTIONS:
1. ANALYTICAL REASONING: Do not use generic "insufficient information" responses. Analyze the business name, email domain, and enrichment snippets to make a logical deduction.
2. ENRICHMENT DATA: The web search snippets and website metadata provided are your strongest signals. Look for keywords like "dr.", "clinic", "hospital" (PRESCRIBER) or "solutions", "group", "ltd" (look deeper for CLIENT/SUPPLIER).
3. HUMAN-READABLE REASON: The 'reason' field must be a clear, human-readable sentence explaining the evidence (e.g., "The search results confirm this is a specialized medical clinic" or "The email domain and name suggest a private individual client").
4. A_QUALIFIER LIMITATION: Use A_QUALIFIER ONLY if there is zero evidence to differentiate. Prefer a logical guess with lower confidence over A_QUALIFIER.
5. CONFIDENCE SCORING: Provide realistic confidence. Clear matches based on enrichment should be 90%+.`;
}

function buildPrompt(request: AIClassificationRequest): string {
  const contactsText = request.contacts.map((c) => {
    const parts = [
      `ID: ${c.index} | Name: ${c.nom_complet}`,
    ];

    if (c.email) parts.push(`Email: ${c.email}`);
    if (c.activites) parts.push(`Stated Activities: ${c.activites}`);
    if (c.ville || c.pays) parts.push(`Location: ${c.ville || ''}, ${c.pays || ''}`);
    
    if (c.enrichment_summary) {
      parts.push(`WEB ENRICHMENT: ${c.enrichment_summary}`);
    }

    return parts.join('\n');
  }).join('\n\n---\n\n');

  return `Please classify the following contacts based on all available data:\n\n${contactsText}`;
}
