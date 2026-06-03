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

  const result = await response.json();
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
