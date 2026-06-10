import { db } from '../db';
import {
  salesFacts,
  regionalRevenue,
  kpiSnapshots,
  demandTimeseries,
  channelPerformance,
  performanceMetrics,
  marketForecasts,
  locations,
  salesChannels
} from '../db/schema';
import { eq } from 'drizzle-orm';
import { mapLocationsToDivisions, getDivisionFallback } from './groq';

export async function recalculateDashboard(userId: string) {
  try {
    const allUserSales = await db.select().from(salesFacts).where(eq(salesFacts.userId, userId));
    
    if (allUserSales.length === 0) {
      await db.delete(regionalRevenue).where(eq(regionalRevenue.userId, userId));
      await db.delete(kpiSnapshots).where(eq(kpiSnapshots.userId, userId));
      await db.delete(demandTimeseries).where(eq(demandTimeseries.userId, userId));
      await db.delete(channelPerformance).where(eq(channelPerformance.userId, userId));
      await db.delete(performanceMetrics).where(eq(performanceMetrics.userId, userId));
      await db.delete(marketForecasts).where(eq(marketForecasts.userId, userId));
      return;
    }

    const userSales = allUserSales.map(s => ({
      ...s,
      date: (typeof s.date === 'string' ? s.date : (s.date as unknown as Date).toISOString().split('T')[0]) as string
    }));

    const existingLocations = await db.select().from(locations).where(eq(locations.userId, userId));
    const locationMap = new Map<string, string>();
    existingLocations.forEach(l => locationMap.set(l.name, l.id));

    const existingChannels = await db.select().from(salesChannels).where(eq(salesChannels.userId, userId));
    const channelMap = new Map<string, string>();
    existingChannels.forEach(c => channelMap.set(c.name, c.id));

    const userLocations = Array.from(locationMap.keys());
    const firstDayOfMonth = new Date();
    firstDayOfMonth.setDate(1);
    const periodStr = firstDayOfMonth.toISOString().split('T')[0]!;

    let groqMapping: Record<string, string> = {};
    try {
      groqMapping = await mapLocationsToDivisions(userLocations);
    } catch (err) {
      console.error('Groq location mapping failed:', err);
    }

    const divisionRevenueMap: Record<string, number> = {};
    const validDivisions = ['Dhaka', 'Chattogram', 'Sylhet', 'Rajshahi', 'Khulna', 'Barishal', 'Rangpur', 'Mymensingh'];
    
    const revByLocId: Record<string, number> = {};
    userSales.forEach(s => { if (s.locationId) revByLocId[s.locationId] = (revByLocId[s.locationId] || 0) + Number(s.revenueBdt); });

    Array.from(locationMap.entries()).forEach(([locName, locId]) => {
      let division = groqMapping[locName];
      if (!division || !validDivisions.includes(division)) {
        division = getDivisionFallback(locName);
      }
      divisionRevenueMap[division] = (divisionRevenueMap[division] || 0) + (revByLocId[locId] || 0);
    });

    const totalRev = Object.values(divisionRevenueMap).reduce((a, b) => a + b, 0) || 1;
    const regionalDataInserts = Object.entries(divisionRevenueMap).filter(([_, rev]) => rev > 0).map(([division, rev]) => ({
      userId, period: periodStr, region: division, revenue: rev.toFixed(2), percentage: ((rev / totalRev) * 100).toFixed(2),
    }));
    await db.delete(regionalRevenue).where(eq(regionalRevenue.userId, userId));
    if (regionalDataInserts.length > 0) await db.insert(regionalRevenue).values(regionalDataInserts);

    const totalRevenueVal = userSales.reduce((sum, item) => sum + Number(item.revenueBdt), 0);
    const activeProductsVal = new Set(userSales.map(item => item.productId)).size;
    const activeUsersVal = userSales.reduce((sum, item) => sum + item.unitsSold, 0);

    await db.delete(kpiSnapshots).where(eq(kpiSnapshots.userId, userId));
    await db.insert(kpiSnapshots).values({
      userId, snapshotDate: new Date().toISOString().split('T')[0]!,
      totalRevenue: totalRevenueVal.toFixed(2), activeProducts: activeProductsVal, forecastAccuracy: '94.20', activeUsers: activeUsersVal,
    });

    const dailySalesTotals: Record<string, number> = {};
    userSales.forEach(s => { if (s.date) dailySalesTotals[s.date] = (dailySalesTotals[s.date] || 0) + s.unitsSold; });
    const timeseriesData = Object.entries(dailySalesTotals).map(([dateStr, actualDemandVal]) => ({
      userId, recordDate: dateStr, actualDemand: actualDemandVal.toFixed(2), forecastDemand: (actualDemandVal * (0.9 + Math.random() * 0.2)).toFixed(2),
    }));
    await db.delete(demandTimeseries).where(eq(demandTimeseries.userId, userId));
    if (timeseriesData.length > 0) await db.insert(demandTimeseries).values(timeseriesData);

    const channelTotals: Record<string, number> = {};
    const revByChanId: Record<string, number> = {};
    userSales.forEach(s => { if (s.channelId) revByChanId[s.channelId] = (revByChanId[s.channelId] || 0) + Number(s.revenueBdt); });
    Array.from(channelMap.entries()).forEach(([chanName, chanId]) => { channelTotals[chanName] = revByChanId[chanId] || 0; });
    
    const totalChannelRevenue = Object.values(channelTotals).reduce((a, b) => a + b, 0) || 1;
    const channelData = Object.entries(channelTotals).filter(([_, rev]) => rev > 0).map(([channel, rev]) => ({
      userId, period: periodStr, channel, revenue: rev.toFixed(2), percentage: ((rev / totalChannelRevenue) * 100).toFixed(2),
    }));
    await db.delete(channelPerformance).where(eq(channelPerformance.userId, userId));
    if (channelData.length > 0) await db.insert(channelPerformance).values(channelData);

    const metricsData = [
      { userId, period: 'current', dimension: 'Sales', value: (Math.random() * 20 + 80).toFixed(2) },
      { userId, period: 'current', dimension: 'Marketing', value: (Math.random() * 20 + 70).toFixed(2) },
      { userId, period: 'current', dimension: 'Support', value: (Math.random() * 20 + 80).toFixed(2) },
      { userId, period: 'current', dimension: 'Logistics', value: (Math.random() * 20 + 75).toFixed(2) },
      { userId, period: 'current', dimension: 'Finance', value: (Math.random() * 10 + 90).toFixed(2) },
    ];
    await db.delete(performanceMetrics).where(eq(performanceMetrics.userId, userId));
    await db.insert(performanceMetrics).values(metricsData);

    const divisionCoords: Record<string, [number, number]> = {
      'Dhaka': [90.4125, 23.8103], 'Chattogram': [91.8317, 22.3569], 'Sylhet': [91.8687, 24.8949], 'Rajshahi': [88.6011, 24.3636],
      'Khulna': [89.5400, 22.8456], 'Barishal': [90.3563, 22.7010], 'Rangpur': [89.2598, 25.7439], 'Mymensingh': [90.4073, 24.7471],
    };
    const marketData = Object.entries(divisionRevenueMap).filter(([_, rev]) => rev > 0).map(([division, rev]) => ({
      userId, country: 'Bangladesh', region: division, geom: divisionCoords[division] || [90.4125, 23.8103],
      forecastedDemand: (rev * 1.1).toFixed(2), currentStock: (Math.random() * 5000 + 1000).toFixed(2),
      confidence: (Math.random() * 10 + 85).toFixed(2), growthRate: (Math.random() * 15 + 5).toFixed(2), period: periodStr,
    }));
    await db.delete(marketForecasts).where(eq(marketForecasts.userId, userId));
    if (marketData.length > 0) await db.insert(marketForecasts).values(marketData);

  } catch (err) {
    console.error('Failed to recalculate downstream tables:', err);
  }
}
