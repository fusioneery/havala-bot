import { lt, eq, and, inArray } from 'drizzle-orm';
import { db, schema } from '../db';
import { config } from '../config';

export async function cleanupOldOffers(): Promise<{ offersDeleted: number; userOffersDeleted: number }> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - config.offerMaxAgeDays);

  console.log(`[Cleanup] Removing offers older than ${cutoffDate.toISOString()}`);

  const oldOffers = await db
    .select({ id: schema.offers.id })
    .from(schema.offers)
    .where(and(
      lt(schema.offers.createdAt, cutoffDate),
      eq(schema.offers.status, 'active'),
    ));

  const oldUserOffers = await db
    .select({ id: schema.userOffers.id })
    .from(schema.userOffers)
    .where(and(
      lt(schema.userOffers.createdAt, cutoffDate),
      eq(schema.userOffers.status, 'active'),
    ));

  let offersDeleted = 0;
  let userOffersDeleted = 0;

  if (oldOffers.length > 0) {
    const offerIds = oldOffers.map((o) => o.id);
    
    await db.delete(schema.matches).where(inArray(schema.matches.matchedOfferId, offerIds));
    
    await db
      .update(schema.offers)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(inArray(schema.offers.id, offerIds));
    
    offersDeleted = offerIds.length;
  }

  if (oldUserOffers.length > 0) {
    const userOfferIds = oldUserOffers.map((o) => o.id);
    
    await db.delete(schema.matches).where(inArray(schema.matches.userOfferId, userOfferIds));
    
    await db
      .update(schema.userOffers)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(inArray(schema.userOffers.id, userOfferIds));
    
    userOffersDeleted = userOfferIds.length;
  }

  console.log(`[Cleanup] Cancelled ${offersDeleted} group offers, ${userOffersDeleted} user offers`);
  return { offersDeleted, userOffersDeleted };
}

let cleanupInterval: ReturnType<typeof setInterval> | null = null;

export function startCleanupJob(): void {
  cleanupOldOffers().catch((err) => {
    console.error('[Cleanup] Initial cleanup failed:', err);
  });

  const oneDayMs = 24 * 60 * 60 * 1000;
  cleanupInterval = setInterval(() => {
    cleanupOldOffers().catch((err) => {
      console.error('[Cleanup] Scheduled cleanup failed:', err);
    });
  }, oneDayMs);

  console.log('[Cleanup] Started daily cleanup job');
}

export function stopCleanupJob(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}
