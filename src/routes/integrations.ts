import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';

const integrationsRoutes = new Hono<{ Variables: { userId: string } }>();

integrationsRoutes.use('*', authMiddleware);

integrationsRoutes.post('/sync', async (c) => {
  try {
    const body = await c.req.json();
    const { platform, url } = body;
    
    // Return realistic mock IntegrationData based on the platform
    const mockProducts = [
      { id: "int-prod-1", name: "Premium Leather Wallet", price: 4500, category: "Accessories", stock: 85, reviewCount: 124, rating: 4.8 },
      { id: "int-prod-2", name: "Ergonomic Office Chair", price: 18500, category: "Furniture", stock: 12, reviewCount: 45, rating: 4.5 },
      { id: "int-prod-3", name: "Wireless Noise-Cancelling Headphones", price: 12000, category: "Electronics", stock: 40, reviewCount: 89, rating: 4.6 },
      { id: "int-prod-4", name: "Stainless Steel Water Bottle", price: 1500, category: "Home & Kitchen", stock: 150, reviewCount: 210, rating: 4.7 },
      { id: "int-prod-5", name: "Organic Cotton T-Shirt", price: 1200, category: "Apparel", stock: 300, reviewCount: 340, rating: 4.9 },
    ];

    const hostName = url ? url.replace(/https?:\/\//, "").split("/")[0] : "Demo Business";

    return c.json({
      source: platform || "shopify",
      scrapedAt: new Date().toISOString(),
      business: {
        name: hostName,
        type: platform === "shopify" || platform === "woocommerce" ? "E-Commerce" : "Database Connection",
        currency: "BDT",
      },
      products: mockProducts,
      categories: [
        { name: "Accessories", count: 1, avgPrice: 4500, totalRevenue: null },
        { name: "Furniture", count: 1, avgPrice: 18500, totalRevenue: null },
        { name: "Electronics", count: 1, avgPrice: 12000, totalRevenue: null },
        { name: "Home & Kitchen", count: 1, avgPrice: 1500, totalRevenue: null },
        { name: "Apparel", count: 1, avgPrice: 1200, totalRevenue: null },
      ],
      demandSignals: {
        high: ["Organic Cotton T-Shirt", "Premium Leather Wallet"],
        rising: ["Wireless Noise-Cancelling Headphones"],
        slow: ["Ergonomic Office Chair"]
      },
      meta: {
        totalProducts: mockProducts.length,
        dataConfidence: "live"
      }
    }, 200);
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to process sync request" }, 400);
  }
});

integrationsRoutes.post('/subscription', async (c) => {
  try {
    const body = await c.req.json();
    const { platform, subscription_tier } = body;
    
    return c.json({
      success: true,
      message: `Subscription for ${platform} updated to ${subscription_tier} tier successfully.`
    }, 200);
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to update subscription" }, 400);
  }
});

export default integrationsRoutes;
