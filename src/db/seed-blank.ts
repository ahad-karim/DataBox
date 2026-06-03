import { db } from './index';
import {
  users,
  kpiSnapshots,
  demandTimeseries,
  channelPerformance,
  performanceMetrics,
  regionalRevenue,
  marketForecasts,
  rawData,
} from './schema';
import * as bcrypt from 'bcryptjs';

async function seedBlank() {
  console.log('Starting blank seed...');

  // 0. Clean database for idempotency
  console.log('Wiping all existing database rows...');
  await db.delete(kpiSnapshots);
  await db.delete(demandTimeseries);
  await db.delete(channelPerformance);
  await db.delete(performanceMetrics);
  await db.delete(regionalRevenue);
  await db.delete(marketForecasts);
  await db.delete(rawData);
  await db.delete(users);

  // 1. Create a fresh, empty demo user (optional, but needed to login)
  const passwordHash = await bcrypt.hash('demo1234', 10);
  const result = await db
    .insert(users)
    .values({
      name: 'John Doe',
      email: 'john@databox.io',
      password: passwordHash,
      plan: 'pro',
    })
    .returning();

  const demoUser = result[0];
  if (!demoUser) {
    throw new Error('Failed to create demo user');
  }

  const userId = demoUser.id;
  console.log(`Created empty demo user: ${userId}`);
  console.log('Login credentials: john@databox.io / demo1234');
  console.log('Database is now completely blank besides the user!');
}

seedBlank().catch((err) => {
  console.error('Blank seed error:', err);
  process.exit(1);
});
