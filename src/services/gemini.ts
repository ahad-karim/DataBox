import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

export async function generateDemandForecast(historicalData: any[], horizonDays: number) {
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }
  const prompt = `
You are a demand forecasting model for an SME dashboard.
Given the following historical daily demand data (JSON array), generate a ${horizonDays}-day forecast.
Return ONLY a valid JSON array with no markdown, no explanation. Each element must have:
{ "date": "YYYY-MM-DD", "forecastDemand": number, "confidence": number (0-1) }

Historical data:
${JSON.stringify(historicalData)}
  `;
  const result = await model.generateContent(prompt);
  const text = result.response.text().replace(/```json|```/g, '').trim();
  return JSON.parse(text);
}

export async function generateInsights(context: string, data: object) {
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }
  const prompt = `
You are a business intelligence assistant for an SME dashboard.
Analyse the following ${context} data and return 3-5 concise, actionable insights.
Return ONLY a valid JSON array of strings, no markdown, no explanation.

Data:
${JSON.stringify(data)}
  `;
  const result = await model.generateContent(prompt);
  const text = result.response.text().replace(/```json|```/g, '').trim();
  return JSON.parse(text) as string[];
}
