import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { syncMeta } from '@/db/schema';

/** Pares llave/valor de la sincronización (cursor de bajada, último resultado). */
export const syncMetaRepo = {
  async get(key: string): Promise<string | null> {
    const row = await db.select().from(syncMeta).where(eq(syncMeta.key, key)).get();
    return row?.value ?? null;
  },

  async set(key: string, value: string): Promise<void> {
    await db
      .insert(syncMeta)
      .values({ key, value })
      .onConflictDoUpdate({ target: syncMeta.key, set: { value } });
  },

  /** Consulta sin ejecutar para useLiveQuery: la pantalla de estado se actualiza sola. */
  valueQuery(key: string) {
    return db.select().from(syncMeta).where(eq(syncMeta.key, key));
  },
};
