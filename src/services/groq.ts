const apiKey = process.env.GROQ_API_KEY || '';

async function queryGroq(systemMessage: string, userMessage: string): Promise<any> {
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not set');
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`Groq API returned error status ${response.status}: ${errorBody}`);
  }

  const result = await response.json() as any;
  const text = result.choices?.[0]?.message?.content || '{}';
  return JSON.parse(text);
}

async function queryGroqText(systemMessage: string, userMessage: string): Promise<string> {
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not set');
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`Groq API returned error status ${response.status}: ${errorBody}`);
  }

  const result = await response.json() as any;
  return result.choices?.[0]?.message?.content || '';
}

export async function generateDemandForecast(historicalData: any[], horizonDays: number): Promise<any[]> {
  const systemMessage = 'You are a demand forecasting assistant. You must output ONLY a valid JSON object matching the requested schema.';
  const userMessage = `
Given the following historical daily demand data, generate a ${horizonDays}-day demand forecast.
You must return a JSON object with a single "forecast" key containing an array of objects. 
Each object in the array must contain:
- "date": "YYYY-MM-DD"
- "forecastDemand": number
- "confidence": number (value between 0 and 1)

Historical data:
${JSON.stringify(historicalData)}

Example output:
{
  "forecast": [
    { "date": "2026-06-03", "forecastDemand": 150.5, "confidence": 0.88 }
  ]
}
  `;

  const parsed = await queryGroq(systemMessage, userMessage);
  if (!parsed || !Array.isArray(parsed.forecast)) {
    throw new Error('Groq returned an invalid forecast format');
  }
  return parsed.forecast;
}

export async function generateInsights(context: string, data: object): Promise<string> {
  const systemMessage = `
<Role>
You are an expert Retail Data Analyst specializing in inventory and market trends.
</Role>

<Task>
Analyze the provided data and extract 3-5 concise, actionable business insights.
</Task>

<Constraints>
- Do NOT return JSON. Return the response in formatted Markdown.
- Group the insights into clear categories using Markdown headings (e.g., ### Stockout chance).
- Under each heading, use a numbered list for specific items or insights.
- Keep each point to a short, punchy phrase or sentence.
- Provide ONLY the formatted headings and lists. Do not include any introductory greetings, explanations, or concluding remarks.
</Constraints>

<Example_Output>
(Note: Replace the items below with ACTUAL products/locations from the provided data. Do not hallucinate or use these example names if they don't exist in the data. You are HIGHLY ENCOURAGED to create completely different categories/headings if you find other interesting patterns in the data. This is just a format reference.)

### Stockout chance
1. [Actual product name from data]
2. [Another product from data]

### Should expand to
1. [Actual location from data]
2. [Another location from data]

### Products performing bad
1. [Actual product from data]
2. [Actual product from data]
</Example_Output>
`;
  const userMessage = `
<Data>
${JSON.stringify(data)}
</Data>
  `;

  const resultText = await queryGroqText(systemMessage, userMessage);
  return resultText;
}

const DIVISION_MAPPING: Record<string, string[]> = {
  "Dhaka": ["dhaka", "savar", "gazipur", "narayanganj", "tangail", "faridpur", "manikganj", "munshiganj", "narsingdi", "shariatpur", "madaripur", "gopalganj", "rajbari", "mohammadpur", "dhanmondi", "gulshan", "uttara", "mirpur"],
  "Chattogram": ["chattogram", "chittagong", "cox's bazar", "coxs bazar", "feni", "hathazari", "baghai chhari", "baghaichhari", "kasba", "brahmanbaria", "comilla", "cumilla", "chandpur", "lakshmipur", "noakhali", "rangamati", "khagrachhari", "bandarban", "agrabad"],
  "Sylhet": ["sylhet", "habiganj", "sunamganj", "moulvibazar", "maulvibazar"],
  "Rajshahi": ["rajshahi", "bogura", "bogra", "natore", "pabna", "naogaon", "joypurhat", "chapainawabganj", "nawabganj", "sirajganj"],
  "Khulna": ["khulna", "jashore", "jessore", "satkhira", "bagerhat", "chuadanga", "kushtia", "magura", "meherpur", "narail", "jhenaidah"],
  "Barishal": ["barishal", "barisal", "patuakhali", "bhola", "barguna", "pirojpur", "jhalokati", "jhalokathi"],
  "Rangpur": ["rangpur", "dinajpur", "kurigram", "gaibandha", "lalmonirhat", "nilphamari", "panchagarh", "thakurgaon"],
  "Mymensingh": ["mymensingh", "netrokona", "sherpur", "jamalpur"]
};

export function getDivisionFallback(location: string): string {
  if (!location) return "Dhaka";
  const loc = location.trim().toLowerCase();
  
  for (const [division, keywords] of Object.entries(DIVISION_MAPPING)) {
    if (keywords.some(k => loc.includes(k))) {
      return division;
    }
  }
  
  // Title case fallback
  return location.charAt(0).toUpperCase() + location.slice(1);
}

export async function mapLocationsToDivisions(locations: string[]): Promise<Record<string, string>> {
  if (!locations || locations.length === 0) {
    return {};
  }

  const systemMessage = 'You are a geographical mapping assistant. You must output ONLY a valid JSON object matching the requested schema.';
  const userMessage = `
Given the following list of location names from Bangladesh, map each location to its corresponding administrative division of Bangladesh.
The divisions must be exactly one of these 8 divisions (case-sensitive):
- Dhaka
- Chattogram
- Sylhet
- Rajshahi
- Khulna
- Barishal
- Rangpur
- Mymensingh

If a location is a neighborhood (e.g., Mohammadpur, Dhanmondi, Gulshan, Uttara, Mirpur), city, district, or upazila within a division, map it to that division (e.g., Mohammadpur belongs to Dhaka, Agrabad belongs to Chattogram).
If a location is completely outside of Bangladesh or cannot be resolved, default to mapping it to "Dhaka".

Locations to map:
${JSON.stringify(locations)}

You must return a JSON object where the keys are the original location names and the values are their mapped divisions.
Example output:
{
  "Mohammadpur": "Dhaka",
  "Agrabad": "Chattogram",
  "Sylhet Sadar": "Sylhet"
}
  `;

  try {
    const parsed = await queryGroq(systemMessage, userMessage);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch (error) {
    console.error('Groq location mapping failed:', error);
  }

  return {};
}

export async function extractProductsFromWebsite(markdown: string): Promise<any[]> {
  const systemMessage = 'You are an e-commerce data extraction assistant. You must output ONLY a valid JSON object matching the requested schema. Do not include markdown blocks or extra text.';
  
  // Truncate markdown to fit within Groq context window if it's too large (Llama 8b limit is 8k tokens, slice to ~15k chars safely)
  const truncatedMarkdown = markdown.length > 15000 ? markdown.slice(0, 15000) + '... (truncated)' : markdown;

  const userMessage = `
Given the following raw markdown content scraped from a website, extract a list of products available for sale or display.
You must return a JSON object with a single "products" key containing an array of objects. 
If no products are found, return an empty array for "products".
Each object in the array must contain:
- "name": string
- "price": number (the price as a numeric value, strip out currency symbols, default to 0 if unknown)
- "category": string (guess the category if not explicitly stated, e.g. "Electronics", "Apparel", "Software", "Unknown")
- "stock": number (guess a random integer between 10 and 200 if stock is not mentioned)
- "reviewCount": number (extract if present, otherwise guess a random integer between 0 and 500)
- "rating": number (extract if present, otherwise guess a random float between 3.5 and 5.0)

Website Markdown Content:
${truncatedMarkdown}
  `;

  try {
    const parsed = await queryGroq(systemMessage, userMessage);
    if (parsed && Array.isArray(parsed.products)) {
      // Add fake IDs to the products
      return parsed.products.map((p: any, i: number) => ({
        id: `ext-prod-${i + 1}-${Math.random().toString(36).substring(2, 7)}`,
        name: p.name || 'Unknown Product',
        price: Number(p.price) || 0,
        category: p.category || 'Uncategorized',
        stock: Number(p.stock) || Math.floor(Math.random() * 190) + 10,
        reviewCount: Number(p.reviewCount) || Math.floor(Math.random() * 500),
        rating: Number(p.rating) || (Math.random() * 1.5 + 3.5).toFixed(1)
      }));
    }
  } catch (error) {
    console.error('Groq product extraction failed:', error);
  }

  return [];
}
