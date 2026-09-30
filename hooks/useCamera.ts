import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { AppState, Linking } from 'react-native';
import {
  CameraView,
  useCameraPermissions,
  type CameraCapturedPicture,
  type CameraType,
} from 'expo-camera';
import { mapPermission } from '@/lib/permissions';
import type { PermissionState } from '@/types/geo';

interface Options {
  /** false cuando la pantalla pierde el foco: la vista de cámara se desmonta. */
  active?: boolean;
}

export interface UseCameraResult {
  cameraRef: RefObject<CameraView | null>;
  permissionState: PermissionState;
  requestPermission: () => Promise<boolean>;
  openSettings: () => Promise<void>;
  facing: CameraType;
  toggleFacing: () => void;
  isReady: boolean;
  onCameraReady: () => void;
  takePhoto: () => Promise<CameraCapturedPicture | null>;
  isCapturing: boolean;
  error: string | null;
  clearError: () => void;
}

export function useCamera({ active = true }: Options = {}): UseCameraResult {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestCameraPermission, getCameraPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [isReady, setIsReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Guarda síncrona: evita dos capturas simultáneas por doble toque
  const capturingRef = useRef(false);

  const permissionState = mapPermission(permission);

  // Al volver de Ajustes, re-consultar el permiso (sin pedirlo)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        getCameraPermission().catch(() => undefined);
      }
    });
    return () => sub.remove();
  }, [getCameraPermission]);

  // Si la vista de cámara se desmonta, deja de estar lista
  useEffect(() => {
    if (!active) setIsReady(false);
  }, [active]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const res = await requestCameraPermission();
      setError(null);
      return res.granted;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo solicitar la cámara');
      return false;
    }
  }, [requestCameraPermission]);

  const toggleFacing = useCallback(() => {
    setIsReady(false);
    setFacing((f) => (f === 'back' ? 'front' : 'back'));
  }, []);

  const onCameraReady = useCallback(() => setIsReady(true), []);

  const takePhoto = useCallback(async (): Promise<CameraCapturedPicture | null> => {
    if (!cameraRef.current || !isReady || capturingRef.current) return null;
    capturingRef.current = true;
    setIsCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      setError(null);
      return photo ?? null;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo tomar la foto');
      return null;
    } finally {
      capturingRef.current = false;
      setIsCapturing(false);
    }
  }, [isReady]);

  const openSettings = useCallback(() => Linking.openSettings(), []);
  const clearError = useCallback(() => setError(null), []);

  return {
    cameraRef,
    permissionState,
    requestPermission,
    openSettings,
    facing,
    toggleFacing,
    isReady,
    onCameraReady,
    takePhoto,
    isCapturing,
    error,
    clearError,
  };
}
