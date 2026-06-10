import { Hono } from 'hono';
import { db } from '../db';
import {
  products,
  locations,
  salesChannels,
  salesFacts,
  inventoryFacts,
  regionalRevenue,
  kpiSnapshots,
  demandTimeseries,
  channelPerformance,
  performanceMetrics,
  marketForecasts,
  datasets
} from '../db/schema';
import { authMiddleware } from '../middleware/auth';
import { parseCSV, isValidDate, isFiniteNumber } from '../services/csvParser';
import { eq } from 'drizzle-orm';
import { mapLocationsToDivisions, getDivisionFallback } from '../services/groq';
import { randomUUID } from 'crypto';
import { recalculateDashboard } from '../services/dashboard';

const uploadRoutes = new Hono<{ Variables: { userId: string } }>();

uploadRoutes.use('*', authMiddleware);

uploadRoutes.post('/', async (c) => {
  const userId = c.get('userId');
  const contentType = c.req.header('Content-Type') || '';

  let parsedRows: any[] = [];
  let fileType = 'json';
  let type = c.req.query('type') || '';
  let fileName = `upload_${Date.now()}.json`;

  if (contentType.includes('multipart/form-data')) {
    fileType = 'csv';
    const body = await c.req.parseBody();
    const file = body['file'];
    if (file && typeof file !== 'string') {
      fileName = file.name;
    } else {
      fileName = `upload_${Date.now()}.csv`;
    }
    if (typeof body['type'] === 'string') {
      type = body['type'];
    }

    const validTypes = ['sales', 'inventory', 'demand', 'expenses'];
    if (!type || !validTypes.includes(type)) {
      return c.json({ error: 'Invalid or missing type parameter', code: 'INVALID_TYPE', details: {} }, 400);
    }

    if (!file || typeof file === 'string') {
      return c.json({ error: 'Missing or invalid file', code: 'MISSING_FILE', details: {} }, 400);
    }

    if (file.size > 5 * 1024 * 1024) {
      return c.json({ error: 'File too large. Maximum size is 5MB.', code: 'FILE_TOO_LARGE' }, 413);
    }

    const fileText = await file.text();
    const { data, errors } = parseCSV(fileText);

    if (errors.length > 0) {
      return c.json({
        error: 'Invalid CSV format',
        code: 'CSV_PARSE_ERROR',
        details: { line: errors[0]?.row, reason: errors[0]?.message }
      }, 400);
    }
    parsedRows = data;
  } else if (contentType.includes('application/json')) {
    try {
      const jsonBody = await c.req.json();
      if (jsonBody && typeof jsonBody === 'object' && !Array.isArray(jsonBody) && typeof jsonBody.type === 'string') {
        type = jsonBody.type;
      }
      const validTypes = ['sales', 'inventory', 'demand', 'expenses'];
      if (!type || !validTypes.includes(type)) {
        return c.json({ error: 'Invalid or missing type parameter', code: 'INVALID_TYPE', details: {} }, 400);
      }
      parsedRows = Array.isArray(jsonBody) ? jsonBody : (jsonBody.data || []);
    } catch (err) {
      return c.json({ error: 'Invalid JSON body', code: 'INVALID_JSON', details: {} }, 400);
    }
  } else {
    return c.json({ error: 'Unsupported Content-Type', code: 'UNSUPPORTED_CONTENT_TYPE', details: {} }, 400);
  }

  let rowsInserted = 0;
  let rowsSkipped = 0;
  const skippedReasons: string[] = [];

  // Fetch existing 3NF entities
  const existingProducts = await db.select().from(products).where(eq(products.userId, userId));
  const existingLocations = await db.select().from(locations).where(eq(locations.userId, userId));
  const existingChannels = await db.select().from(salesChannels).where(eq(salesChannels.userId, userId));

  const productMap = new Map<string, string>();
  existingProducts.forEach(p => productMap.set(p.name, p.id));
  const locationMap = new Map<string, string>();
  existingLocations.forEach(l => locationMap.set(l.name, l.id));
  const channelMap = new Map<string, string>();
  existingChannels.forEach(c => channelMap.set(c.name, c.id));

  const newProducts: any[] = [];
  const newLocations: any[] = [];
  const newChannels: any[] = [];
  
  const salesFactsInserts: any[] = [];
  const inventoryFactsInserts: any[] = [];

  const datasetInsert = await db.insert(datasets).values({
    userId,
    fileName
  }).returning({ id: datasets.id });
  const datasetId = datasetInsert[0]!.id;

  for (let i = 0; i < parsedRows.length; i++) {
    const row = parsedRows[i];
    if (!row) continue;
    const rowNum = i + 1;

    const getVal = (possibleKeys: string[]): string | undefined => {
      for (const key of possibleKeys) {
        if (row[key] !== undefined && row[key] !== null) {
          return String(row[key]).trim();
        }
      }
      return undefined;
    };

    const dateVal = getVal(['Date', 'date']);
    const productName = getVal(['Product_Name', 'product_name', 'product', 'Product_name']);
    const category = getVal(['Category', 'category']);
    const location = getVal(['Location', 'location', 'region', 'Region']);
    const salesChannel = getVal(['Sales_Channel', 'sales_channel', 'channel', 'Sales_channel']);
    const unitsSold = getVal(['Units_Sold', 'units_sold', 'units', 'Units_sold']);
    const revenueBdt = getVal(['Revenue_BDT', 'revenue_bdt', 'revenue', 'Revenue_bdt']);
    const costPrice = getVal(['Cost_Price', 'cost_price', 'cost', 'Cost_price']);
    const currentStock = getVal(['Current_Stock', 'current_stock', 'stock', 'Current_stock']);
    
    const customerSegment = getVal(['Customer_Segment', 'customer_segment', 'segment', 'Customer_segment']) || 'General';

    if (!dateVal || !productName || !category || !location || !salesChannel || !unitsSold || !revenueBdt || !costPrice || !currentStock) {
      rowsSkipped++;
      skippedReasons.push(`Row ${rowNum}: missing required fields`);
      continue;
    }

    if (!isValidDate(dateVal)) {
      rowsSkipped++;
      skippedReasons.push(`Row ${rowNum}: invalid date format`);
      continue;
    }

    if (!isFiniteNumber(unitsSold) || !isFiniteNumber(revenueBdt) || !isFiniteNumber(costPrice) || !isFiniteNumber(currentStock)) {
      rowsSkipped++;
      skippedReasons.push(`Row ${rowNum}: invalid numeric values`);
      continue;
    }

    const units = Math.round(Number(unitsSold));
    const rev = Number(revenueBdt);
    const cost = Number(costPrice);
    const stock = Math.round(Number(currentStock));

    let unitP = getVal(['Unit_Price', 'unit_price', 'price', 'Unit_price']);
    let calculatedUnitPrice = 0;
    if (unitP && isFiniteNumber(unitP)) {
      calculatedUnitPrice = Number(unitP);
    } else {
      calculatedUnitPrice = units > 0 ? (rev / units) : rev;
    }

    let productId = productMap.get(productName);
    if (!productId) {
      productId = randomUUID();
      productMap.set(productName, productId);
      newProducts.push({ id: productId, userId, name: productName, category, unitPrice: calculatedUnitPrice.toFixed(2), costPrice: cost.toFixed(2) });
    }

    let locationId = locationMap.get(location);
    if (!locationId) {
      locationId = randomUUID();
      locationMap.set(location, locationId);
      newLocations.push({ id: locationId, userId, name: location });
    }

    let channelId = channelMap.get(salesChannel);
    if (!channelId) {
      channelId = randomUUID();
      channelMap.set(salesChannel, channelId);
      newChannels.push({ id: channelId, userId, name: salesChannel });
    }

    salesFactsInserts.push({
      userId,
      datasetId,
      date: dateVal,
      productId,
      locationId,
      channelId,
      unitsSold: units,
      revenueBdt: rev.toFixed(2),
      customerSegment,
    });

    inventoryFactsInserts.push({
      userId,
      datasetId,
      date: dateVal,
      productId,
      locationId,
      currentStock: stock,
    });

    rowsInserted++;
  }

  if (salesFactsInserts.length > 0) {
    if (newProducts.length > 0) await db.insert(products).values(newProducts);
    if (newLocations.length > 0) await db.insert(locations).values(newLocations);
    if (newChannels.length > 0) await db.insert(salesChannels).values(newChannels);
    
    await db.insert(salesFacts).values(salesFactsInserts);
    await db.insert(inventoryFacts).values(inventoryFactsInserts);

    try {
      await recalculateDashboard(userId);
    } catch (err) {
      console.error('Failed to update downstream tables during upload:', err);
    }
  }

  return c.json({ message: 'Upload successful', type: fileType, rowsInserted, rowsSkipped, skippedReasons, datasetId }, 200);
});

export default uploadRoutes;
