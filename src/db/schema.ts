import {
  pgTable,
  uuid,
  text,
  numeric,
  integer,
  timestamp,
  date,
  jsonb,
  geometry,
  index,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  email: text('email').unique().notNull(),
  password: text('password').notNull(),
  avatarUrl: text('avatar_url'),
  plan: text('plan').default('free'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const datasets = pgTable('datasets', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  fileName: text('file_name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const kpiSnapshots = pgTable('kpi_snapshots', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id),
  snapshotDate: date('snapshot_date').notNull(),
  totalRevenue: numeric('total_revenue', { precision: 12, scale: 2 }),
  activeProducts: integer('active_products'),
  forecastAccuracy: numeric('forecast_accuracy', { precision: 5, scale: 2 }),
  activeUsers: integer('active_users'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const demandTimeseries = pgTable('demand_timeseries', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id),
  recordDate: date('record_date').notNull(),
  actualDemand: numeric('actual_demand', { precision: 12, scale: 2 }),
  forecastDemand: numeric('forecast_demand', { precision: 12, scale: 2 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const channelPerformance = pgTable('channel_performance', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id),
  period: date('period').notNull(),
  channel: text('channel').notNull(),
  revenue: numeric('revenue', { precision: 12, scale: 2 }),
  percentage: numeric('percentage', { precision: 5, scale: 2 }),
});

export const performanceMetrics = pgTable('performance_metrics', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id),
  period: text('period').notNull(),
  dimension: text('dimension').notNull(),
  value: numeric('value', { precision: 5, scale: 2 }),
});

export const regionalRevenue = pgTable('regional_revenue', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id),
  period: date('period').notNull(),
  region: text('region').notNull(),
  revenue: numeric('revenue', { precision: 12, scale: 2 }),
  percentage: numeric('percentage', { precision: 5, scale: 2 }),
});

export const marketForecasts = pgTable(
  'market_forecasts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id),
    country: text('country').notNull(),
    region: text('region').notNull(),
    geom: geometry('geom', { type: 'point', mode: 'tuple', srid: 4326 }),
    forecastedDemand: numeric('forecasted_demand', { precision: 12, scale: 2 }),
    currentStock: numeric('current_stock', { precision: 12, scale: 2 }),
    confidence: numeric('confidence', { precision: 5, scale: 2 }),
    growthRate: numeric('growth_rate', { precision: 6, scale: 2 }),
    period: date('period').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    geomIdx: index('market_forecasts_geom_idx').using('gist', table.geom),
  })
);

export const dataPipelineEvents = pgTable('data_pipeline_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id),
  eventType: text('event_type').notNull(),
  source: text('source'),
  status: text('status').notNull(),
  rowsAffected: integer('rows_affected'),
  message: text('message'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const products = pgTable('products', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id),
  name: text('name').notNull(),
  category: text('category').notNull(),
  unitPrice: numeric('unit_price', { precision: 12, scale: 2 }).notNull(),
  costPrice: numeric('cost_price', { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const locations = pgTable('locations', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id),
  name: text('name').notNull(),
  region: text('region'),
  geom: geometry('geom', { type: 'point', mode: 'tuple', srid: 4326 }),
});

export const salesChannels = pgTable('sales_channels', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id),
  name: text('name').notNull(),
});

export const salesFacts = pgTable('sales_facts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  datasetId: uuid('dataset_id').references(() => datasets.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  productId: uuid('product_id').references(() => products.id),
  locationId: uuid('location_id').references(() => locations.id),
  channelId: uuid('channel_id').references(() => salesChannels.id),
  unitsSold: integer('units_sold').notNull(),
  revenueBdt: numeric('revenue_bdt', { precision: 12, scale: 2 }).notNull(),
  customerSegment: text('customer_segment'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const inventoryFacts = pgTable('inventory_facts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  datasetId: uuid('dataset_id').references(() => datasets.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  productId: uuid('product_id').references(() => products.id),
  locationId: uuid('location_id').references(() => locations.id),
  currentStock: integer('current_stock').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
