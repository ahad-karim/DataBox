import { db } from './src/db';
import { marketForecasts } from './src/db/schema';
import { v4 as uuidv4 } from 'uuid';

async function testInsert() {
  try {
    const userId = "e86d8470-730b-455c-80df-f370bd44c937"; // Assuming the demo user
    console.log("Attempting insert...");
    await db.insert(marketForecasts).values({
      userId,
      country: 'Bangladesh',
      region: 'Dhaka',
      geom: [90.4125, 23.8103],
      forecastedDemand: "1000",
      currentStock: "500",
      confidence: "80.5",
      growthRate: "5.5",
      period: '2026-06-01'
    });
    console.log("Insert successful!");
    process.exit(0);
  } catch (err) {
    console.error("Insert failed:", err);
    process.exit(1);
  }
}

testInsert();
