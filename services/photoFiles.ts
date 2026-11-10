import { Directory, File, Paths } from 'expo-file-system';

// La cámara y el selector de galería entregan archivos en caché, que el sistema puede borrar.
// Se copian a documentos para que la URI guardada en SQLite siga siendo válida.
const photosDir = new Directory(Paths.document, 'photos');

/** Copia la foto a la carpeta de documentos y devuelve la URI permanente. */
export async function persistPhoto(cacheUri: string): Promise<string> {
  if (!photosDir.exists) photosDir.create({ intermediates: true, idempotent: true });
  const source = new File(cacheUri);
  const ext = source.extension || '.jpg';
  const destination = new File(photosDir, `${Date.now()}${ext}`);
  // En SDK 57 copy() es asíncrono (copySync es la variante síncrona)
  await source.copy(destination);
  return destination.uri;
}

/**
 * Descarga el archivo de una foto que vino de la nube (Semana 9). Se nombra con su clientId,
 * así que si ya se descargó antes no se vuelve a bajar. `url` es una URL firmada: el bucket es privado.
 */
export async function downloadPhotoFile(url: string, clientId: string): Promise<string> {
  if (!photosDir.exists) photosDir.create({ intermediates: true, idempotent: true });
  const destination = new File(photosDir, `${clientId}.jpg`);
  if (destination.exists) return destination.uri;
  const file = await File.downloadFileAsync(url, destination);
  return file.uri;
}

/** Borra el archivo si existe. Tolera URIs que ya no existen (p. ej. fotos antiguas en caché). */
export function deletePhotoFile(uri: string): void {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
    if (__DEV__) console.log(`[photoFiles] ${file.name} existe tras borrar: ${new File(uri).exists}`);
  } catch (e) {
    if (__DEV__) console.warn('[photoFiles] no se pudo borrar', uri, e);
  }
}
