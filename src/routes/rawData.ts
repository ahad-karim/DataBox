import { Hono } from 'hono';
import { db } from '../db';
import { products, locations, salesChannels, salesFacts, inventoryFacts } from '../db/schema';
import { authMiddleware } from '../middleware/auth';
import { eq, desc, sql, and } from 'drizzle-orm';

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
    .from(salesFacts)
    .where(eq(salesFacts.userId, userId));
  const total = Number(countResult[0]?.count || 0);

  // Fetch paginated rows
  const data = await db
    .select({
      date: salesFacts.date,
      productId: products.id,
      productName: products.name,
      category: products.category,
      location: locations.name,
      salesChannel: salesChannels.name,
      unitsSold: salesFacts.unitsSold,
      revenueBdt: salesFacts.revenueBdt,
      unitPrice: products.unitPrice,
      costPrice: products.costPrice,
      customerSegment: salesFacts.customerSegment,
      currentStock: inventoryFacts.currentStock,
    })
    .from(salesFacts)
    .innerJoin(products, eq(salesFacts.productId, products.id))
    .innerJoin(locations, eq(salesFacts.locationId, locations.id))
    .innerJoin(salesChannels, eq(salesFacts.channelId, salesChannels.id))
    .leftJoin(inventoryFacts, and(
      eq(salesFacts.productId, inventoryFacts.productId),
      eq(salesFacts.locationId, inventoryFacts.locationId),
      eq(salesFacts.date, inventoryFacts.date)
    ))
    .where(eq(salesFacts.userId, userId))
    .orderBy(desc(salesFacts.date))
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
      Current_Stock: d.currentStock || 0,
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
  
  const data = await db
    .select({
      date: salesFacts.date,
      productId: products.id,
      productName: products.name,
      category: products.category,
      location: locations.name,
      salesChannel: salesChannels.name,
      unitsSold: salesFacts.unitsSold,
      revenueBdt: salesFacts.revenueBdt,
      unitPrice: products.unitPrice,
      costPrice: products.costPrice,
      customerSegment: salesFacts.customerSegment,
      currentStock: inventoryFacts.currentStock,
    })
    .from(salesFacts)
    .innerJoin(products, eq(salesFacts.productId, products.id))
    .innerJoin(locations, eq(salesFacts.locationId, locations.id))
    .innerJoin(salesChannels, eq(salesFacts.channelId, salesChannels.id))
    .leftJoin(inventoryFacts, and(
      eq(salesFacts.productId, inventoryFacts.productId),
      eq(salesFacts.locationId, inventoryFacts.locationId),
      eq(salesFacts.date, inventoryFacts.date)
    ))
    .where(eq(salesFacts.userId, userId))
    .orderBy(desc(salesFacts.date));
  
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
      row.currentStock || 0,
      `"${(row.customerSegment || '').replace(/"/g, '""')}"`
    ].join(','));
  }
  
  const csvContent = csvRows.join('\n');
  
  c.header('Content-Type', 'text/csv');
  c.header('Content-Disposition', 'attachment; filename="raw-data.csv"');
  return c.body(csvContent);
});

export default rawDataRoutes;
