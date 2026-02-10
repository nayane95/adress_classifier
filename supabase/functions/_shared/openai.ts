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

  const prompt = buildPrompt(request);

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
            content: getSystemPrompt(request.language),
          },
          {
            role: 'user',
            content: prompt,
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
    };
  } catch (error) {
    console.error('OpenAI classification error:', error);
    throw error;
  }
}

function getSystemPrompt(language: 'en' | 'fr'): string {
  if (language === 'fr') {
    return `Vous êtes un expert en classification de contacts professionnels. Classifiez chaque contact dans EXACTEMENT UNE catégorie:

- CLIENT: Clients finaux, acheteurs, consommateurs, patients directs
- PRESCRIBER: Médecins, prescripteurs, professionnels de santé, cliniques, hôpitaux, pharmaciens
- SUPPLIER: Fournisseurs, vendeurs, distributeurs, grossistes, fabricants

Utilisez A_QUALIFIER UNIQUEMENT en dernier recours si aucune classification n'est possible.

Règles strictes:
1. Préférez toujours CLIENT, PRESCRIBER ou SUPPLIER à A_QUALIFIER
2. Utilisez les signaux publics disponibles (nom, activités, email, enrichissement)
3. Fournissez une raison concise (≤160 caractères)
4. Listez les signaux utilisés (≤240 caractères)
5. Marquez needs_review=true si confidence < 70%`;
  }

  return `You are an expert at classifying professional contacts. Classify each contact into EXACTLY ONE category:

- CLIENT: End clients, buyers, consumers, direct patients
- PRESCRIBER: Doctors, prescribers, healthcare professionals, clinics, hospitals, pharmacists
- SUPPLIER: Suppliers, vendors, distributors, wholesalers, manufacturers

Use A_QUALIFIER ONLY as a last resort if no classification is possible.

Strict rules:
1. Always prefer CLIENT, PRESCRIBER, or SUPPLIER over A_QUALIFIER
2. Use available public signals (name, activities, email, enrichment)
3. Provide concise reason (≤160 chars)
4. List signals used (≤240 chars)
5. Mark needs_review=true if confidence < 70%`;
}

function buildPrompt(request: AIClassificationRequest): string {
  const contactsText = request.contacts.map((c, i) => {
    const parts = [
      `[${c.index}] ${c.nom_complet}`,
    ];

    if (c.activites) parts.push(`Activities: ${c.activites}`);
    if (c.email) parts.push(`Email: ${c.email}`);
    if (c.ville) parts.push(`City: ${c.ville}`);
    if (c.pays) parts.push(`Country: ${c.pays}`);
    if (c.enrichment_summary) parts.push(`Enrichment: ${c.enrichment_summary}`);

    return parts.join(' | ');
  }).join('\n');

  return `Classify these contacts:\n\n${contactsText}`;
}
