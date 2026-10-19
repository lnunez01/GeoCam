import { and, asc, desc, eq, getTableColumns, isNotNull, isNull, like, lt, not, or, type SQL } from 'drizzle-orm';
import * as Crypto from 'expo-crypto';
import { db } from '@/db/client';
import { albums, photos, type NewPhoto } from '@/db/schema';
import type { PhotoFilters } from '@/types/geo';

export type PhotoChanges = Partial<Pick<NewPhoto, 'note' | 'favorite' | 'albumId'>>;

/** Fotos con el nombre de su álbum. La tabla principal sigue siendo photos (la que escucha useLiveQuery). */
function selectWithAlbum() {
  return db
    .select({ ...getTableColumns(photos), albumName: albums.name })
    .from(photos)
    .leftJoin(albums, eq(photos.albumId, albums.id));
}

export const photosRepo = {
  /** Consulta sin ejecutar: la ejecuta useLiveQuery para mantenerse reactiva. */
  listQuery() {
    return selectWithAlbum().orderBy(desc(photos.createdAt));
  },

  withLocationQuery() {
    return selectWithAlbum().where(isNotNull(photos.latitude)).orderBy(desc(photos.createdAt));
  },

  filteredQuery({ search, albumId = null, onlyFavorites = false }: PhotoFilters) {
    const conditions: SQL[] = [];
    const term = search?.trim();
    if (term) conditions.push(like(photos.note, `%${term}%`));
    if (albumId === 'none') conditions.push(isNull(photos.albumId));
    else if (albumId !== null) conditions.push(eq(photos.albumId, albumId));
    if (onlyFavorites) conditions.push(eq(photos.favorite, true));

    return selectWithAlbum()
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(photos.createdAt));
  },

  detailQuery(id: number) {
    return selectWithAlbum().where(eq(photos.id, id)).limit(1);
  },

  allUris() {
    return db.select({ uri: photos.uri }).from(photos).all();
  },

  findById(id: number) {
    return db.select().from(photos).where(eq(photos.id, id)).get();
  },

  create(data: Omit<NewPhoto, 'id' | 'clientId'>) {
    return db
      .insert(photos)
      .values({ ...data, clientId: Crypto.randomUUID() })
      .returning()
      .get();
  },

  /** Cambios del usuario: siempre marcan updatedAt para que la foto quede pendiente de subir. */
  update(id: number, data: PhotoChanges) {
    return db
      .update(photos)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(photos.id, id));
  },

  /**
   * Fotos pendientes de subir: nunca subidas (syncedAt vacío) o editadas después de la última
   * subida (syncedAt < updatedAt). Las de prueba de las herramientas de desarrollo no cuentan.
   */
  pendingUploads() {
    return db
      .select()
      .from(photos)
      .where(
        and(
          or(isNull(photos.syncedAt), lt(photos.syncedAt, photos.updatedAt)),
          not(like(photos.uri, 'file:///dev-seed/%'))
        )
      )
      .orderBy(asc(photos.createdAt))
      .all();
  },

  /** Marca la foto como subida. NO toca updatedAt: si lo hiciera, la foto volvería a quedar pendiente. */
  markSynced(id: number, remotePath: string) {
    return db
      .update(photos)
      .set({ remotePath, syncedAt: new Date() })
      .where(eq(photos.id, id));
  },

  /**
   * Las fotos tomadas antes de la migración de la Semana 8 quedan sin clientId ni updatedAt.
   * Se rellenan una sola vez al arrancar, después de las migraciones.
   */
  ensureSyncFields() {
    const rows = db.select().from(photos).where(isNull(photos.clientId)).all();
    for (const row of rows) {
      db.update(photos)
        .set({ clientId: Crypto.randomUUID(), updatedAt: row.updatedAt ?? row.createdAt })
        .where(eq(photos.id, row.id))
        .run();
    }
    return rows.length;
  },

  remove(id: number) {
    return db.delete(photos).where(eq(photos.id, id));
  },

  clearAll() {
    return db.delete(photos);
  },
};
