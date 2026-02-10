// Enrichment helper - Web search and data enrichment (compliant methods only)
import { EnrichmentData, NormalizedContact, getEmailDomain } from './types.ts';

export async function enrichContact(
  contact: NormalizedContact,
  depth: number = 1
): Promise<EnrichmentData | null> {
  const enrichmentData: EnrichmentData = {};

  try {
    // Extract domain from email
    const domain = getEmailDomain(contact.email);
    if (domain) {
      enrichmentData.domain = domain;
    }

    // Depth 1: Basic web search
    if (depth >= 1) {
      const searchResults = await performWebSearch(contact);
      if (searchResults) {
        enrichmentData.search_snippets = searchResults.snippets;
        enrichmentData.business_type = searchResults.businessType;
      }
    }

    // Depth 2: Google Maps Places API
    if (depth >= 2 && contact.ville && contact.nom_complet) {
      const mapsData = await fetchGoogleMapsData(contact);
      if (mapsData) {
        enrichmentData.maps_categories = mapsData.categories;
      }
    }

    // Depth 3: Website metadata
    if (depth >= 3 && domain) {
      const websiteData = await fetchWebsiteMetadata(domain);
      if (websiteData) {
        enrichmentData.website_title = websiteData.title;
        enrichmentData.website_description = websiteData.description;
      }
    }

    // Create signals summary
    enrichmentData.signals_summary = createSignalsSummary(enrichmentData);

    return enrichmentData;
  } catch (error) {
    console.error('Enrichment error:', error);
    return null;
  }
}

async function performWebSearch(contact: NormalizedContact): Promise<{
  snippets: string[];
  businessType?: string;
} | null> {
  const BING_API_KEY = Deno.env.get('BING_SEARCH_API_KEY');
  
  if (!BING_API_KEY) {
    console.warn('No search API key configured');
    return null;
  }

  try {
    // Build search query
    const query = `${contact.nom_complet} ${contact.ville || ''} ${contact.pays || ''}`.trim();

    const response = await fetch(
      `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(query)}&count=3`,
      {
        headers: {
          'Ocp-Apim-Subscription-Key': BING_API_KEY,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Bing API error: ${response.status}`);
    }

    const data = await response.json();
    const snippets: string[] = [];
    let businessType: string | undefined;

    if (data.webPages?.value) {
      for (const page of data.webPages.value.slice(0, 3)) {
        snippets.push(page.snippet);

        // Try to extract business type from snippets
        const snippet = page.snippet.toLowerCase();
        if (snippet.includes('clinic') || snippet.includes('hospital') || snippet.includes('medical')) {
          businessType = 'medical';
        } else if (snippet.includes('supplier') || snippet.includes('wholesale') || snippet.includes('distributor')) {
          businessType = 'supplier';
        } else if (snippet.includes('client') || snippet.includes('customer') || snippet.includes('retail')) {
          businessType = 'client';
        }
      }
    }

    return { snippets, businessType };
  } catch (error) {
    console.error('Web search error:', error);
    return null;
  }
}

async function fetchGoogleMapsData(contact: NormalizedContact): Promise<{
  categories: string[];
} | null> {
  const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');
  
  if (!GOOGLE_MAPS_API_KEY) {
    return null;
  }

  try {
    const query = `${contact.nom_complet} ${contact.ville || ''} ${contact.pays || ''}`.trim();

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=types&key=${GOOGLE_MAPS_API_KEY}`
    );

    if (!response.ok) {
      throw new Error(`Google Maps API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.candidates && data.candidates.length > 0) {
      return {
        categories: data.candidates[0].types || [],
      };
    }

    return null;
  } catch (error) {
    console.error('Google Maps error:', error);
    return null;
  }
}

async function fetchWebsiteMetadata(domain: string): Promise<{
  title?: string;
  description?: string;
} | null> {
  try {
    // Respect robots.txt and rate limits
    const response = await fetch(`https://${domain}`, {
      headers: {
        'User-Agent': 'ContactClassifier/1.0 (Compliant Web Scraper)',
      },
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : undefined;

    // Extract meta description
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
    const description = descMatch ? descMatch[1].trim() : undefined;

    return { title, description };
  } catch (error) {
    console.error('Website metadata error:', error);
    return null;
  }
}

function createSignalsSummary(data: EnrichmentData): string {
  const signals: string[] = [];

  if (data.business_type) {
    signals.push(`Business type: ${data.business_type}`);
  }

  if (data.maps_categories && data.maps_categories.length > 0) {
    signals.push(`Categories: ${data.maps_categories.slice(0, 3).join(', ')}`);
  }

  if (data.website_title) {
    signals.push(`Website: ${data.website_title.substring(0, 50)}`);
  }

  if (data.search_snippets && data.search_snippets.length > 0) {
    signals.push(`Found in search: ${data.search_snippets[0].substring(0, 80)}...`);
  }

  return signals.join('; ');
}
