import { Hono } from 'hono';
import { db } from '../db';
import { rawData, demandTimeseries } from '../db/schema';
import { authMiddleware } from '../middleware/auth';
import { parseCSV, isValidDate, isFiniteNumber } from '../services/csvParser';

const uploadRoutes = new Hono<{ Variables: { userId: string } }>();

uploadRoutes.use('*', authMiddleware);

uploadRoutes.post('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.parseBody();

  const file = body['file'];
  const type = body['type'];

  if (!file || typeof file === 'string') {
    return c.json({ error: 'Missing or invalid file', code: 'MISSING_FILE', details: {} }, 400);
  }

  if (file.size > 5 * 1024 * 1024) {
    return c.json({ error: 'File too large. Maximum size is 5MB.', code: 'FILE_TOO_LARGE' }, 413);
  }

  const validTypes = ['sales', 'inventory', 'demand', 'expenses'];
  if (!type || typeof type !== 'string' || !validTypes.includes(type)) {
    return c.json({ error: 'Invalid or missing type parameter', code: 'INVALID_TYPE', details: {} }, 400);
  }

  const fileText = await file.text();
  const { data, errors } = parseCSV(fileText);

  // If papaparse has structural errors on the file level
  if (errors.length > 0) {
    return c.json({
      error: 'Invalid CSV format',
      code: 'CSV_PARSE_ERROR',
      details: { line: errors[0]?.row, reason: errors[0]?.message }
    }, 400);
  }

  let rowsInserted = 0;
  let rowsSkipped = 0;
  const skippedReasons: string[] = [];

  const rawDataInserts: any[] = [];
  const demandInserts: any[] = [];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row) continue;
    const rowNum = i + 1; // 1-based data row number

    // Extract common fields (flexible header naming)
    const dateVal = row['date']?.trim();

    if (!dateVal) {
      rowsSkipped++;
      skippedReasons.push(`Row ${rowNum}: missing date`);
      continue;
    }

    if (!isValidDate(dateVal)) {
      rowsSkipped++;
      skippedReasons.push(`Row ${rowNum}: invalid date format (expected YYYY-MM-DD)`);
      continue;
    }

    if (type === 'sales') {
      const source = row['source']?.trim();
      const category = row['category']?.trim();
      const value = row['value']?.trim();

      if (!source || !category || !value) {
        rowsSkipped++;
        skippedReasons.push(`Row ${rowNum}: missing required fields (source, category, or value)`);
        continue;
      }

      if (!isFiniteNumber(value)) {
        rowsSkipped++;
        skippedReasons.push(`Row ${rowNum}: invalid value`);
        continue;
      }

      rawDataInserts.push({
        userId,
        recordDate: dateVal,
        source,
        category,
        value: Number(value).toFixed(2),
      });
      rowsInserted++;
    } else if (type === 'demand') {
      const actualDemand = row['actual_demand']?.trim();
      const forecastDemand = row['forecast_demand']?.trim();

      if (!actualDemand) {
        rowsSkipped++;
        skippedReasons.push(`Row ${rowNum}: missing actual_demand`);
        continue;
      }

      if (!isFiniteNumber(actualDemand)) {
        rowsSkipped++;
        skippedReasons.push(`Row ${rowNum}: invalid actual_demand`);
        continue;
      }

      let forecastNum: string | null = null;
      if (forecastDemand !== undefined && forecastDemand !== null && forecastDemand !== '') {
        if (!isFiniteNumber(forecastDemand)) {
          rowsSkipped++;
          skippedReasons.push(`Row ${rowNum}: invalid forecast_demand`);
          continue;
        }
        forecastNum = Number(forecastDemand).toFixed(2);
      }

      demandInserts.push({
        userId,
        recordDate: dateVal,
        actualDemand: Number(actualDemand).toFixed(2),
        forecastDemand: forecastNum,
      });
      rowsInserted++;
    } else if (type === 'inventory') {
      const source = row['source']?.trim();
      const product = row['product']?.trim();
      const quantity = row['quantity']?.trim();
      const value = row['value']?.trim();

      if (!source || !product || !quantity || !value) {
        rowsSkipped++;
        skippedReasons.push(`Row ${rowNum}: missing required fields (source, product, quantity, or value)`);
        continue;
      }

      if (!isFiniteNumber(quantity) || !isFiniteNumber(value)) {
        rowsSkipped++;
        skippedReasons.push(`Row ${rowNum}: invalid quantity or value`);
        continue;
      }

      rawDataInserts.push({
        userId,
        recordDate: dateVal,
        source,
        category: 'Inventory',
        value: Number(value).toFixed(2),
        metadata: {
          product,
          quantity: Number(quantity),
        },
      });
      rowsInserted++;
    } else if (type === 'expenses') {
      const source = row['source']?.trim();
      const description = row['description']?.trim();
      const amount = row['amount']?.trim();

      if (!source || !description || !amount) {
        rowsSkipped++;
        skippedReasons.push(`Row ${rowNum}: missing required fields (source, description, or amount)`);
        continue;
      }

      if (!isFiniteNumber(amount)) {
        rowsSkipped++;
        skippedReasons.push(`Row ${rowNum}: invalid amount`);
        continue;
      }

      rawDataInserts.push({
        userId,
        recordDate: dateVal,
        source,
        category: 'Expenses',
        value: Number(amount).toFixed(2),
        metadata: {
          description,
        },
      });
      rowsInserted++;
    }
  }

  // Perform bulk inserts
  if (rawDataInserts.length > 0) {
    await db.insert(rawData).values(rawDataInserts);
  }
  if (demandInserts.length > 0) {
    await db.insert(demandTimeseries).values(demandInserts);
  }

  return c.json({
    message: 'Upload successful',
    type,
    rowsInserted,
    rowsSkipped,
    skippedReasons,
  }, 200);
});

export default uploadRoutes;
