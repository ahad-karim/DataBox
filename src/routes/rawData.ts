import { Hono } from 'hono';
import { db } from '../db';
import { rawData } from '../db/schema';
import { authMiddleware } from '../middleware/auth';
import { eq, desc, sql } from 'drizzle-orm';

const rawDataRoutes = new Hono<{ Variables: { userId: string } }>();

rawDataRoutes.use('*', authMiddleware);

rawDataRoutes.get('/', async (c) => {
  const userId = c.get('userId');
  
  const page = Math.max(1, Number(c.req.query('page') || '1'));
  const limit = Math.max(1, Math.min(100000, Number(c.req.query('limit') || '100000')));
  const offset = (page - 1) * limit;

  // Fetch count
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(rawData)
    .where(eq(rawData.userId, userId));
  const total = Number(countResult[0]?.count || 0);

  // Fetch paginated rows
  const data = await db
    .select()
    .from(rawData)
    .where(eq(rawData.userId, userId))
    .orderBy(desc(rawData.date))
    .limit(limit)
    .offset(offset);
  
  return c.json({
    data: data.map(d => ({
      Date: d.date,
      Product_ID: d.productId || '',
      Product_Name: d.productName,
      Category: d.category,
      Location: d.location,
      Sales_Channel: d.salesChannel,
      Units_Sold: d.unitsSold,
      Revenue_BDT: d.revenueBdt ? Number(d.revenueBdt) : 0,
      Unit_Price: d.unitPrice ? Number(d.unitPrice) : 0,
      Cost_Price: d.costPrice ? Number(d.costPrice) : 0,
      Current_Stock: d.currentStock,
      Customer_Segment: d.customerSegment || '',
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    }
  });
});

rawDataRoutes.get('/export', async (c) => {
  const userId = c.get('userId');
  
  // Fetch all user's rows for export
  const data = await db
    .select()
    .from(rawData)
    .where(eq(rawData.userId, userId))
    .orderBy(desc(rawData.date));
  
  const headers = [
    'Date',
    'Product_ID',
    'Product_Name',
    'Category',
    'Location',
    'Sales_Channel',
    'Units_Sold',
    'Revenue_BDT',
    'Unit_Price',
    'Cost_Price',
    'Current_Stock',
    'Customer_Segment'
  ];
  
  const csvRows = [headers.join(',')];
  
  for (const row of data) {
    csvRows.push([
      row.date,
      row.productId || '',
      `"${row.productName.replace(/"/g, '""')}"`,
      `"${row.category.replace(/"/g, '""')}"`,
      `"${row.location.replace(/"/g, '""')}"`,
      `"${row.salesChannel.replace(/"/g, '""')}"`,
      row.unitsSold,
      row.revenueBdt,
      row.unitPrice,
      row.costPrice,
      row.currentStock,
      `"${(row.customerSegment || '').replace(/"/g, '""')}"`
    ].join(','));
  }
  
  const csvContent = csvRows.join('\n');
  
  c.header('Content-Type', 'text/csv');
  c.header('Content-Disposition', 'attachment; filename="raw-data.csv"');
  return c.body(csvContent);
});

export default rawDataRoutes;
