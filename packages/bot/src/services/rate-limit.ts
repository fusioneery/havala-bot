import { eq, gte, and, count } from 'drizzle-orm';
import { db, schema } from '../db';
import { config } from '../config';

export interface RateLimitResult {
  allowed: boolean;
  dailyCount: number;
  monthlyCount: number;
  dailyLimit: number;
  monthlyLimit: number;
}

export async function checkRateLimit(userId: number): Promise<RateLimitResult> {
  const now = new Date();
  
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [dailyResult] = await db
    .select({ count: count() })
    .from(schema.offerRequests)
    .where(and(
      eq(schema.offerRequests.userId, userId),
      gte(schema.offerRequests.createdAt, dayStart),
    ));

  const [monthlyResult] = await db
    .select({ count: count() })
    .from(schema.offerRequests)
    .where(and(
      eq(schema.offerRequests.userId, userId),
      gte(schema.offerRequests.createdAt, monthStart),
    ));

  const dailyCount = dailyResult?.count ?? 0;
  const monthlyCount = monthlyResult?.count ?? 0;

  const allowed = dailyCount < config.rateLimitDailyOffers && monthlyCount < config.rateLimitMonthlyOffers;

  return {
    allowed,
    dailyCount,
    monthlyCount,
    dailyLimit: config.rateLimitDailyOffers,
    monthlyLimit: config.rateLimitMonthlyOffers,
  };
}

export async function recordOfferRequest(userId: number): Promise<void> {
  await db.insert(schema.offerRequests).values({ userId });
}
