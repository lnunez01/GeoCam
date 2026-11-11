import { and, asc, desc, eq, getTableColumns, gt, isNotNull, isNull, like, not, or, sql, type SQL } from 'drizzle-orm';
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

/** C5: cada consulta de fotos se limita al usuario de la sesión. */
const ownedBy = (ownerId: string) => eq(photos.ownerId, ownerId);

/** Semana 9 (C1): las fotos marcadas como borradas no se muestran. */
const visible = isNull(photos.deletedAt);

/**
 * Pendiente de subir: nunca subida (syncedAt vacío) o editada después de la última subida.
 * Incluye las marcas de borrado, que también hay que subir. Las de prueba de las
 * herramientas de desarrollo no cuentan.
 */
const pending = and(
  or(isNull(photos.syncedAt), gt(photos.updatedAt, photos.syncedAt)),
  not(like(photos.uri, 'file:///dev-seed/%'))
);

/** Datos de una foto que llegó de la nube (pull). */
export type RemotePhotoInput = Pick<
  NewPhoto,
  'clientId' | 'uri' | 'latitude' | 'longitude' | 'note' | 'favorite' | 'source' | 'createdAt' | 'remotePath' | 'deletedAt'
> & { ownerId: string; updatedAt: Date; syncedAt: Date };

/** Lo que pull puede cambiar en una foto que ya existe en el teléfono. */
export type RemoteChanges = Pick<NewPhoto, 'note' | 'favorite' | 'deletedAt'> & {
  updatedAt: Date;
  syncedAt: Date;
  /** Solo cuando hubo que volver a descargar el archivo. */
  uri?: string;
};

export const photosRepo = {
  /** Consulta sin ejecutar: la ejecuta useLiveQuery para mantenerse reactiva. */
  listQuery(ownerId: string) {
    return selectWithAlbum().where(and(ownedBy(ownerId), visible)).orderBy(desc(photos.createdAt));
  },

  withLocationQuery(ownerId: string) {
    return selectWithAlbum()
      .where(and(ownedBy(ownerId), visible, isNotNull(photos.latitude)))
      .orderBy(desc(photos.createdAt));
  },

  filteredQuery(ownerId: string, { search, albumId = null, onlyFavorites = false }: PhotoFilters) {
    const conditions: SQL[] = [ownedBy(ownerId), visible];
    const term = search?.trim();
    if (term) conditions.push(like(photos.note, `%${term}%`));
    if (albumId === 'none') conditions.push(isNull(photos.albumId));
    else if (albumId !== null) conditions.push(eq(photos.albumId, albumId));
    if (onlyFavorites) conditions.push(eq(photos.favorite, true));

    return selectWithAlbum()
      .where(and(...conditions))
      .orderBy(desc(photos.createdAt));
  },

  /** Una foto de otro usuario no se encuentra, aunque se conozca su id. */
  detailQuery(ownerId: string, id: number) {
    return selectWithAlbum()
      .where(and(ownedBy(ownerId), visible, eq(photos.id, id)))
      .limit(1);
  },


  findById(id: number) {
    return db.select().from(photos).where(eq(photos.id, id)).get();
  },

  create(data: Omit<NewPhoto, 'id' | 'clientId'> & { ownerId: string }) {
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

  /** Consulta sin ejecutar de las pendientes: el indicador de sincronización la escucha con useLiveQuery. */
  pendingQuery(ownerId: string) {
    return db.select({ id: photos.id }).from(photos).where(and(ownedBy(ownerId), pending));
  },

  /** Fotos pendientes de subir (incluye las marcas de borrado), de la más antigua a la más nueva. */
  listPending(ownerId: string) {
    return db
      .select()
      .from(photos)
      .where(and(ownedBy(ownerId), pending))
      .orderBy(asc(photos.createdAt))
      .all();
  },

  findByClientId(clientId: string) {
    return db.select().from(photos).where(eq(photos.clientId, clientId)).get();
  },

  /** Foto creada en otro teléfono: nace sincronizada (syncedAt = updatedAt remoto). */
  insertFromRemote(data: RemotePhotoInput) {
    return db.insert(photos).values(data).run();
  },

  /**
   * Aplica la versión de la nube cuando es más nueva ("gana el último cambio").
   * Usa las fechas que llegan de la nube, nunca la hora actual.
   */
  applyRemote(id: number, changes: RemoteChanges) {
    return db.update(photos).set(changes).where(eq(photos.id, id)).run();
  },

  /**
   * Marca la foto como subida con la versión que se subió (no con "ahora"): si el usuario la
   * editó mientras se subía, su updatedAt es posterior y la foto sigue pendiente.
   * NO toca updatedAt: si lo hiciera, la foto volvería a quedar pendiente.
   */
  markSynced(id: number, remotePath: string, syncedAt: Date) {
    return db.update(photos).set({ remotePath, syncedAt }).where(eq(photos.id, id)).run();
  },

  /**
   * Borrado lógico (C1): deletedAt y updatedAt con la hora actual. El borrado cuenta como el
   * último cambio, así que gana a una edición anterior hecha en otro teléfono.
   */
  markDeleted(id: number) {
    const now = new Date();
    return db.update(photos).set({ deletedAt: now, updatedAt: now }).where(eq(photos.id, id)).run();
  },

  /** Marcas de borrado ya subidas cuyo archivo todavía no se ha eliminado (uri vacía = eliminado). */
  listDeletedToPurge(ownerId: string) {
    return db
      .select()
      .from(photos)
      .where(
        and(
          ownedBy(ownerId),
          isNotNull(photos.deletedAt),
          isNotNull(photos.syncedAt),
          not(gt(photos.updatedAt, photos.syncedAt)),
          not(eq(photos.uri, ''))
        )
      )
      .all();
  },

  /** El archivo local ya se eliminó: la fila queda como marca (lápida) para no volver a bajarla. */
  markPurged(id: number) {
    return db.update(photos).set({ uri: '' }).where(eq(photos.id, id)).run();
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

  /** Borrado físico: solo para fotos que nunca llegaron a la nube (nadie más las conoce). */
  hardDelete(id: number) {
    return db.delete(photos).where(eq(photos.id, id)).run();
  },

  /** Fotos con archivo en el teléfono (de todos los usuarios), para revisar que sus URIs sigan vigentes. */
  listWithFiles() {
    return db.select().from(photos).where(and(visible, not(eq(photos.uri, '')))).all();
  },

  /** Corrige la URI del archivo. NO toca updatedAt: no es un cambio del usuario y no debe quedar pendiente. */
  setUri(id: number, uri: string) {
    return db.update(photos).set({ uri }).where(eq(photos.id, id)).run();
  },

  /** Fotos visibles del usuario (para borrarlas todas al agitar el teléfono). */
  listVisible(ownerId: string) {
    return db.select().from(photos).where(and(ownedBy(ownerId), visible)).all();
  },

  /**
   * Las fotos tomadas antes del C5 no tienen dueño. Al iniciar sesión se asignan:
   * 1. Las que ya se habían subido pertenecen al usuario de su carpeta en el bucket
   *    (remotePath = '<userId>/<clientId>.jpg').
   * 2. El resto, al usuario que inicia sesión (eran de quien usaba el teléfono antes de las cuentas).
   */
  claimUnowned(ownerId: string) {
    db.update(photos)
      .set({ ownerId: sql`substr(${photos.remotePath}, 1, instr(${photos.remotePath}, '/') - 1)` })
      .where(and(isNull(photos.ownerId), isNotNull(photos.remotePath)))
      .run();
    db.update(photos).set({ ownerId }).where(isNull(photos.ownerId)).run();
  },
};
