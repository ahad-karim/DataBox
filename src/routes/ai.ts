import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { aiInsightsSchema, demandForecastGenerateSchema } from '../validators/schemas';
import { authMiddleware } from '../middleware/auth';
import { generateInsights, generateDemandForecast } from '../services/groq';
import { db } from '../db';
import { demandTimeseries } from '../db/schema';
import { eq, desc } from 'drizzle-orm';

const aiRoutes = new Hono<{ Variables: { userId: string } }>();

aiRoutes.use('*', authMiddleware);

aiRoutes.post('/insights', zValidator('json', aiInsightsSchema), async (c) => {
  const { context, data } = c.req.valid('json');

  try {
    const insights = await generateInsights(context, data);
    return c.json({ insights, generatedAt: new Date().toISOString() });
  } catch (error) {
    return c.json({ error: 'Failed to generate insights', code: 'AI_ERROR', details: {} }, 500);
  }
});

// ── Chat endpoint (mirrors /api/chat from Next.js) ────────────────────────────
aiRoutes.post('/chat', async (c) => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return c.json({ reply: 'GROQ_API_KEY is not configured on the server.' }, 500);
  }

  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ reply: 'Invalid JSON body.' }, 400); }

  const { message, history = [], rawData = [] } = body;

  let context = 'The user has not uploaded any data yet. Tell them to upload data to get insights.';
  if (rawData.length > 0) {
    const totalRevenue = rawData.reduce((acc: number, row: any) => acc + (row.Revenue_BDT || 0), 0);
    const totalUnits = rawData.reduce((acc: number, row: any) => acc + (row.Units_Sold || 0), 0);
    context = `The user has uploaded sales data. Summary:\n- Total Revenue (BDT): ${totalRevenue}\n- Total Units Sold: ${totalUnits}\n- Total Records: ${rawData.length}\n- Sample: ${JSON.stringify(rawData.slice(0, 5))}`;
  }

  const systemPrompt = `You are Bizanolytics Intelligence, a hyper-intelligent, professional data analyst assistant for SMEs in Bangladesh. You must ONLY answer questions related to business analytics, supply chain, and the user's uploaded data. If the user asks about politics, coding, self-harm, general trivia, or any unethical/unrelated topics, politely refuse and redirect them back to business analytics.\n\nContext:\n${context}`;

  const messages: any[] = [{ role: 'system', content: systemPrompt }];
  for (const msg of history) {
    messages.push({ role: msg.role === 'assistant' ? 'assistant' : 'user', content: msg.content });
  }
  messages.push({ role: 'user', content: message });

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama-3.1-8b-instant', messages }),
    });
    const data = await res.json() as any;
    const reply = data.choices?.[0]?.message?.content || 'No reply generated.';
    return c.json({ reply });
  } catch {
    return c.json({ reply: 'Error generating reply. Please try again.' }, 500);
  }
});

// ── Impute-data endpoint (mirrors /api/impute-data from Next.js) ─────────────
aiRoutes.post('/impute', async (c) => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return c.json({ error: 'GROQ_API_KEY is not configured.' }, 500);

  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body.' }, 400); }

  const { targetColumn, products } = body;
  if (!targetColumn || !Array.isArray(products) || products.length === 0) {
    return c.json({ error: 'Missing required fields (targetColumn, products array).' }, 400);
  }

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'You are a data processing assistant. The user will provide a list of product names. Categorize each product into a general commercial category (e.g., Electronics, Clothing, Groceries, Home Goods, etc.). Output ONLY a valid JSON object with a single key "categories" containing an array of objects, each with exactly "productName" and "category" keys.',
          },
          { role: 'user', content: `Products: ${JSON.stringify(products)}` },
        ],
      }),
    });
    const data = await res.json() as any;
    const raw = data.choices?.[0]?.message?.content || '{}';
    let parsed: any;
    try { parsed = JSON.parse(raw); } catch { return c.json({ error: 'Failed to parse AI response.' }, 500); }
    return c.json({ mapping: parsed.categories || [] });
  } catch {
    return c.json({ error: 'Error generating imputation. AI service may be unavailable.' }, 500);
  }
});

// ── Forecast-insight endpoint (mirrors /api/forecast-insight from Next.js) ────
aiRoutes.post('/forecast-insight', async (c) => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return c.json({ insight: 'GROQ_API_KEY is not configured on the server.' }, 500);

  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ insight: 'Invalid JSON body.' }, 400); }

  const rawData: any[] = body?.rawData || [];
  const language: string = body?.language || 'en';

  if (rawData.length === 0) {
    return c.json({ insight: language === 'bn' ? 'বিশ্লেষণ করার জন্য কোন ডেটা আপলোড করা হয়নি।' : 'No data uploaded to analyze.' }, 400);
  }

  const totalRevenue = rawData.reduce((acc: number, row: any) => acc + (row.Revenue_BDT || 0), 0);
  const totalUnits = rawData.reduce((acc: number, row: any) => acc + (row.Units_Sold || 0), 0);
  const summary = `Recent Sales Data Summary:\n- Total Revenue (BDT): ${totalRevenue}\n- Total Units Sold: ${totalUnits}\n- Total Records Analyzed: ${rawData.length}\n- Sample Data (first 3 rows): ${JSON.stringify(rawData.slice(0, 3))}`;

  const systemPrompt = language === 'bn'
    ? 'You are an expert commerce intelligence assistant for SMEs in Bangladesh. Keep it very professional and direct. Provide 3 concise, actionable forecasting insights formatted as bullet points based on the data summary provided. YOU MUST WRITE YOUR ENTIRE RESPONSE IN BENGALI (BANGLA).'
    : 'You are an expert commerce intelligence assistant for SMEs in Bangladesh. Keep it very professional and direct. Provide 3 concise, actionable forecasting insights formatted as bullet points based on the data summary provided.';

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Analyze this sales data and provide insights on stockout risks, trends, or pricing recommendations:\n\n${summary}` },
        ],
      }),
    });
    const data = await res.json() as any;
    const insight = data.choices?.[0]?.message?.content || 'No insight generated.';
    return c.json({ insight });
  } catch {
    return c.json({ insight: 'Error generating insight. Please ensure the Groq API key is valid.' }, 500);
  }
});

// ── Demand forecast generate (originally mounted separately) ──────────────────
export const generateForecastRoute = new Hono<{ Variables: { userId: string } }>();
generateForecastRoute.post('/', authMiddleware, zValidator('json', demandForecastGenerateSchema), async (c) => {
  const { horizonDays } = c.req.valid('json');
  const userId = c.get('userId');

  try {
    const data = await db.select().from(demandTimeseries).where(eq(demandTimeseries.userId, userId)).orderBy(desc(demandTimeseries.recordDate)).limit(90);
    
    const historicalData = data.reverse().map(d => ({
      date: d.recordDate,
      demand: d.actualDemand
    }));

    const forecast = await generateDemandForecast(historicalData, horizonDays);
    
    // Insert into db (actualDemand = null)
    if (Array.isArray(forecast)) {
      const rows = forecast.map((f: any) => ({
        userId,
        recordDate: f.date,
        forecastDemand: String(f.forecastDemand),
      }));
      if (rows.length > 0) {
        await db.insert(demandTimeseries).values(rows);
      }
    }

    return c.json({ forecast, generatedAt: new Date().toISOString() });
  } catch (error) {
    return c.json({ error: 'Failed to generate forecast', code: 'AI_ERROR', details: {} }, 500);
  }
});

export default aiRoutes;
