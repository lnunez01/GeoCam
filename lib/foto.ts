import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import type { FileUIPart } from 'ai';

/**
 * Abre la cámara o la galería y devuelve la foto lista para useChat:
 * reducida a 1024 px de ancho y JPEG 0.7 como data URL.
 */
export async function elegirFoto(origen: 'camara' | 'galeria'): Promise<FileUIPart | null> {
  const permiso =
    origen === 'camara'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permiso.granted) throw new Error('Sin permiso no se puede adjuntar la foto.');

  const opciones: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
  const res =
    origen === 'camara'
      ? await ImagePicker.launchCameraAsync(opciones)
      : await ImagePicker.launchImageLibraryAsync(opciones);
  if (res.canceled) return null;

  return reducirFoto(res.assets[0].uri);
}

export async function reducirFoto(uri: string): Promise<FileUIPart> {
  const ctx = ImageManipulator.manipulate(uri);
  ctx.resize({ width: 1024 });
  const imagen = await ctx.renderAsync();
  const guardada = await imagen.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
  return {
    type: 'file',
    mediaType: 'image/jpeg',
    filename: 'foto.jpg',
    url: `data:image/jpeg;base64,${guardada.base64}`,
  };
}
