import { Hono } from 'hono';
import { db } from '../db';
import { rawData } from '../db/schema';
import { authMiddleware } from '../middleware/auth';
import { parseCSV, isValidDate, isFiniteNumber } from '../services/csvParser';

const uploadRoutes = new Hono<{ Variables: { userId: string } }>();

uploadRoutes.use('*', authMiddleware);

uploadRoutes.post('/', async (c) => {
  const userId = c.get('userId');
  const contentType = c.req.header('Content-Type') || '';

  let parsedRows: any[] = [];
  let fileType = 'json';
  let type = c.req.query('type') || '';

  if (contentType.includes('multipart/form-data')) {
    fileType = 'csv';
    const body = await c.req.parseBody();
    const file = body['file'];
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
  const rawDataInserts: any[] = [];

  for (let i = 0; i < parsedRows.length; i++) {
    const row = parsedRows[i];
    if (!row) continue;
    const rowNum = i + 1;

    // Helper to resolve case-insensitive / underscore variations in keys
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
    
    // Optional / inferrable fields
    const productId = getVal(['Product_ID', 'product_id', 'id', 'Product_id']);
    const customerSegment = getVal(['Customer_Segment', 'customer_segment', 'segment', 'Customer_segment']) || 'General';

    if (!dateVal || !productName || !category || !location || !salesChannel || !unitsSold || !revenueBdt || !costPrice || !currentStock) {
      rowsSkipped++;
      skippedReasons.push(`Row ${rowNum}: missing required fields (Date, Product_Name, Category, Location, Sales_Channel, Units_Sold, Revenue_BDT, Cost_Price, or Current_Stock)`);
      continue;
    }

    if (!isValidDate(dateVal)) {
      rowsSkipped++;
      skippedReasons.push(`Row ${rowNum}: invalid date format (expected YYYY-MM-DD)`);
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

    // Calculate unit price dynamically if not provided or 0
    let unitP = getVal(['Unit_Price', 'unit_price', 'price', 'Unit_price']);
    let calculatedUnitPrice = 0;
    if (unitP && isFiniteNumber(unitP)) {
      calculatedUnitPrice = Number(unitP);
    } else {
      calculatedUnitPrice = units > 0 ? (rev / units) : rev;
    }

    // Auto-generate product ID if missing
    const finalProductId = productId || `PRD-${productName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 5).toUpperCase()}`;

    rawDataInserts.push({
      userId,
      date: dateVal,
      productId: finalProductId,
      productName,
      category,
      location,
      salesChannel,
      unitsSold: units,
      revenueBdt: rev.toFixed(2),
      unitPrice: calculatedUnitPrice.toFixed(2),
      costPrice: cost.toFixed(2),
      currentStock: stock,
      customerSegment,
    });
    rowsInserted++;
  }

  if (rawDataInserts.length > 0) {
    await db.insert(rawData).values(rawDataInserts);
  }

  return c.json({
    message: 'Upload successful',
    type: fileType,
    rowsInserted,
    rowsSkipped,
    skippedReasons,
  }, 200);
});

export default uploadRoutes;
