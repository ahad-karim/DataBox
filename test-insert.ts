import { db } from './src/db';
import { marketForecasts } from './src/db/schema';
async function testInsert() {
  try {
    const userId = "e86d8470-730b-455c-80df-f370bd44c937"; // Assuming the demo user
    console.log("Attempting insert...");

    // Insert user first to avoid foreign key violation
    await db.insert(require('./src/db/schema').users).values({
      id: userId,
      name: "Demo User",
      email: "demo@example.com",
      password: "password"
    }).onConflictDoNothing();

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
