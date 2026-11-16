import * as Crypto from 'expo-crypto';
import { and, asc, desc, eq, getTableColumns, isNotNull, isNull, like, lt, or, type SQL } from 'drizzle-orm';
import { db } from '@/db/client';
import { albums, photos, type NewPhoto } from '@/db/schema';
import type { PhotoFilters } from '@/types/geo';

export type PhotoChanges = Partial<Pick<NewPhoto, 'note' | 'favorite' | 'albumId' | 'aiDescription'>>;

/** Nunca subida, o editada después de la última sincronización. */
function isPending() {
  return or(isNull(photos.syncedAt), lt(photos.syncedAt, photos.updatedAt));
}

/** Solo las fotos del usuario de la sesión: otra cuenta en el mismo teléfono no las ve. */
function ownedBy(ownerId: string) {
  return eq(photos.ownerId, ownerId);
}

/** Una foto concreta del usuario: un id de otra cuenta no encuentra nada. */
function ownPhoto(id: number, ownerId: string) {
  return and(eq(photos.id, id), ownedBy(ownerId));
}

/** C1: lo que ve la UI. Las fotos marcadas como borradas solo existen para avisarle a la nube. */
function visibleTo(ownerId: string) {
  return and(ownedBy(ownerId), isNull(photos.deletedAt));
}

/** Fotos con el nombre de su álbum. La tabla principal sigue siendo photos (la que escucha useLiveQuery). */
function selectWithAlbum() {
  return db
    .select({ ...getTableColumns(photos), albumName: albums.name })
    .from(photos)
    .leftJoin(albums, eq(photos.albumId, albums.id));
}

export const photosRepo = {
  /** Consulta sin ejecutar: la ejecuta useLiveQuery para mantenerse reactiva. */
  listQuery(ownerId: string) {
    return selectWithAlbum().where(visibleTo(ownerId)).orderBy(desc(photos.createdAt));
  },

  withLocationQuery(ownerId: string) {
    return selectWithAlbum()
      .where(and(visibleTo(ownerId), isNotNull(photos.latitude)))
      .orderBy(desc(photos.createdAt));
  },

  filteredQuery(ownerId: string, { search, albumId = null, onlyFavorites = false }: PhotoFilters) {
    const conditions: SQL[] = [ownedBy(ownerId), isNull(photos.deletedAt)];
    const term = search?.trim();
    if (term) conditions.push(like(photos.note, `%${term}%`));
    if (albumId === 'none') conditions.push(isNull(photos.albumId));
    else if (albumId !== null) conditions.push(eq(photos.albumId, albumId));
    if (onlyFavorites) conditions.push(eq(photos.favorite, true));

    return selectWithAlbum()
      .where(and(...conditions))
      .orderBy(desc(photos.createdAt));
  },

  detailQuery(id: number, ownerId: string) {
    return selectWithAlbum()
      .where(and(ownPhoto(id, ownerId), isNull(photos.deletedAt)))
      .limit(1);
  },

  /** Pendientes de subir, de la más antigua a la más reciente. Incluye las marcadas como borradas (C1). */
  pendingForUpload(ownerId: string) {
    return selectWithAlbum()
      .where(and(ownedBy(ownerId), isPending()))
      .orderBy(asc(photos.createdAt))
      .all();
  },

  /**
   * Consulta sin ejecutar para useLiveQuery: el indicador y la pantalla de sincronización se actualizan solos.
   * Devuelve filas (no un COUNT) porque saber si el archivo existe no lo puede responder SQLite.
   */
  pendingQuery(ownerId: string) {
    return db
      .select({
        id: photos.id,
        uri: photos.uri,
        remotePath: photos.remotePath,
        note: photos.note,
        createdAt: photos.createdAt,
        deletedAt: photos.deletedAt,
      })
      .from(photos)
      .where(and(ownedBy(ownerId), isPending()))
      .orderBy(asc(photos.createdAt));
  },

  findById(id: number, ownerId: string) {
    return db.select().from(photos).where(ownPhoto(id, ownerId)).get();
  },

  create(data: Omit<NewPhoto, 'id' | 'ownerId'>, ownerId: string) {
    return db
      .insert(photos)
      .values({ ...data, ownerId })
      .returning()
      .get();
  },

  /** Toda edición del usuario renueva updatedAt: así la foto vuelve a quedar pendiente de subir. */
  update(id: number, ownerId: string, data: PhotoChanges) {
    return db
      .update(photos)
      .set({ ...data, updatedAt: new Date() })
      .where(ownPhoto(id, ownerId));
  },

  /**
   * Semana 10 (T5): guarda la descripción de IA (o la versión que editó el usuario).
   * Pasa por update(), que escribe updatedAt: la foto queda pendiente y la descripción se sube.
   */
  setDescription(id: number, ownerId: string, aiDescription: string | null) {
    return this.update(id, ownerId, { aiDescription });
  },

  /**
   * Solo registra la sincronización. syncedAt = la versión (updatedAt) que se subió, nunca "ahora":
   * si el usuario editó durante la subida, updatedAt > syncedAt y la foto sigue pendiente.
   * No toca updatedAt: si lo hiciera, la foto nunca quedaría al día.
   */
  markSynced(id: number, ownerId: string, remotePath: string, syncedAt: Date) {
    // .run(): una consulta de Drizzle sin await ni .run() nunca se ejecuta (QueryPromise es perezosa)
    return db
      .update(photos)
      .set({ remotePath, syncedAt })
      .where(ownPhoto(id, ownerId))
      .run();
  },

  // ---------- Semana 9: bajada desde la nube ----------

  /** La misma foto en este teléfono (identidad compartida), solo si es del usuario. */
  findByClientId(clientId: string, ownerId: string) {
    return db
      .select()
      .from(photos)
      .where(and(eq(photos.clientId, clientId), ownedBy(ownerId)))
      .get();
  },

  /** Foto que llegó de la nube: nace sincronizada (syncedAt = updatedAt remoto) y con su dueño. */
  insertFromRemote(data: Omit<NewPhoto, 'id' | 'ownerId'>, ownerId: string) {
    return db
      .insert(photos)
      .values({ ...data, ownerId })
      .returning()
      .get();
  },

  /** Aplica en local una versión más nueva de la nube. Nunca usa la hora actual. */
  applyRemote(
    id: number,
    ownerId: string,
    changes: {
      note: string | null;
      favorite: boolean;
      aiDescription: string | null;
      updatedAt: Date;
      syncedAt: Date;
    }
  ) {
    return db.update(photos).set(changes).where(ownPhoto(id, ownerId)).run();
  },

  /**
   * Las filas creadas antes de la migración 0003 no tienen clientId ni updatedAt
   * (SQLite no ejecuta $defaultFn al agregar columnas). Se completan una vez al arrancar.
   * Es mantenimiento de todo el teléfono: no depende del usuario.
   */
  ensureSyncFields() {
    const rows = db
      .select({ id: photos.id, createdAt: photos.createdAt, updatedAt: photos.updatedAt })
      .from(photos)
      .where(isNull(photos.clientId))
      .all();
    if (rows.length === 0) return 0;
    db.transaction((tx) => {
      for (const row of rows) {
        tx.update(photos)
          .set({ clientId: Crypto.randomUUID(), updatedAt: row.updatedAt ?? row.createdAt })
          .where(eq(photos.id, row.id))
          .run();
      }
    });
    return rows.length;
  },

  /** Fotos de antes de la Semana 8 (sin dueño): pasan a ser del usuario indicado. */
  claimOrphans(ownerId: string) {
    return db.update(photos).set({ ownerId }).where(isNull(photos.ownerId)).run();
  },

  // ---------- Semana 9 (C1): borrado lógico ----------

  /**
   * Borrar = marcar. Funciona sin conexión: deletedAt y updatedAt = ahora, así la foto desaparece
   * de la UI y queda pendiente; push le avisa a la nube y después la borra de verdad (purge).
   */
  markDeleted(id: number, ownerId: string) {
    const now = new Date();
    return db
      .update(photos)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(ownPhoto(id, ownerId), isNull(photos.deletedAt)))
      .run();
  },

  /** "Borrar todo" (shake): el mismo borrado lógico para todas las fotos visibles del usuario. */
  markAllDeleted(ownerId: string) {
    const now = new Date();
    return db
      .update(photos)
      .set({ deletedAt: now, updatedAt: now })
      .where(visibleTo(ownerId))
      .run();
  },

  /** Borrado físico de la fila local. Solo lo usa la sincronización, cuando la nube ya se enteró. */
  purge(id: number, ownerId: string) {
    return db.delete(photos).where(ownPhoto(id, ownerId)).run();
  },
};
