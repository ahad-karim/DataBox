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

export async function generateInsights(context: string, data: object): Promise<string[]> {
  const systemMessage = 'You are a business intelligence assistant. You must output ONLY a valid JSON object matching the requested schema.';
  const userMessage = `
Analyse the following ${context} data and return 3-5 concise, actionable business insights.
You must return a JSON object with a single "insights" key containing an array of strings.

Data:
${JSON.stringify(data)}

Example output:
{
  "insights": [
    "Insight 1 goes here",
    "Insight 2 goes here"
  ]
}
  `;

  const parsed = await queryGroq(systemMessage, userMessage);
  if (!parsed || !Array.isArray(parsed.insights)) {
    throw new Error('Groq returned an invalid insights format');
  }
  return parsed.insights;
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

