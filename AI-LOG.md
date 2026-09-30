# Registro de Auditoría de IA (AI-LOG)

**Estudiante(s):** _Nombre Apellido, Nombre Apellido_
**Semana:** 6
**Proyecto:** GeoCam – Taller Integrador 2
**Herramienta:** Claude Code (asistente de programación con IA)

## 1. Prompts Utilizados

- "Tengo que hacer esta app de esta guía, ayúdame" (adjuntando el PDF de la Guía Semana 6), con los
  requisitos del entregable: `useGeoLocation`, `useCamera`, `useShake`, README con los tres estados de
  permiso y este AI-LOG.

## 2. Código Generado vs. Código Modificado

- **¿Qué generó la IA?:** El proyecto Expo (SDK 57) con Expo Router, los tres hooks, `PermissionPrimer`,
  `GeoPhotosContext`, las pestañas GeoCam y Mapa, basados en el código de la guía.
- **¿Qué modifiqué/corregí respecto al código de la guía?:**
  - **Limpieza al salir de la pestaña:** en una navegación por pestañas las pantallas *no se desmontan*
    al cambiar de pestaña, así que el cleanup de `useEffect` nunca corría y el GPS seguía encendido.
    Se agregó la opción `enabled` a `useGeoLocation` y `useShake`, alimentada con `useIsFocused()`,
    y la `CameraView` solo se monta mientras la pestaña tiene el foco.
  - **Doble toque en el obturador:** `useCamera` usaba el estado `isCapturing` como guarda dentro de un
    `useCallback`; entre dos toques rápidos el valor del cierre podía estar desactualizado. Se agregó
    una `ref` (`capturingRef`) como guarda síncrona y se mantuvo el estado solo para la UI.
  - **Errores como estado:** `takePhoto` no capturaba excepciones; ahora `useCamera` expone
    `error`/`clearError` y `useGeoLocation` también guarda errores de consulta/solicitud de permiso.
  - **Volver de Ajustes:** tras "Abrir Ajustes" la app no se enteraba del nuevo permiso. Ambos hooks
    re-consultan (sin pedir) el permiso al volver `AppState` a `active`.
  - `mapPermission` se movió a `lib/permissions.ts` para reutilizarlo en cámara y ubicación.
  - La pantalla previa de cámara ofrece "Importar desde galería" para degradar con elegancia.
  - `useShake` guarda el callback en una `ref`, verifica `isAvailableAsync()`, usa
    `setUpdateInterval(100)`, umbral de 1.8 g sobre √(x²+y²+z²) y enfriamiento de 1000 ms.
  - Se usó `StyleSheet` en lugar de clases de NativeWind para no depender de su configuración.

## 3. Alucinaciones o Errores Detectados

- **API obsoleta de Tabs:** el código de la guía / de la IA importa `Tabs` desde `'expo-router'`.
  En el SDK 57 esa exportación está marcada `@deprecated` en los tipos de `expo-router`
  ("Use `import { Tabs } from 'expo-router/js-tabs'` instead"). Se corrigió el import.
- **Refs durante el render:** al usar el objeto completo `cam` (que contiene `cameraRef`) en el JSX,
  la regla `react-hooks/refs` del compilador de React reportó 14 errores
  "Cannot access refs during render". Se corrigió desestructurando el resultado de `useCamera`.
- **`npx expo install` falló** (sin acceso a la API de compatibilidad de Expo en el entorno). En lugar de
  usar `npm install paquete@latest` —que podría instalar versiones incompatibles— se tomaron las versiones
  exactas de `node_modules/expo/bundledNativeModules.json`, que es la misma tabla que usa `expo install`.
- Se verificaron en los `.d.ts` instalados las APIs que suelen alucinarse: `CameraView` +
  `useCameraPermissions()` (no `Camera.requestCameraPermissionsAsync`), `mediaTypes: ['images']`
  (no `MediaTypeOptions.Images`), permisos por módulo (no `expo-permissions`) y solo ubicación en
  primer plano (no `requestBackgroundPermissionsAsync`).

## 4. Verificación

- `npx tsc --noEmit` y `npx expo lint`: sin errores.
- `npx expo export --platform android`: el bundle compila.
- Pruebas en iPhone físico con Expo Go (capturas en `docs/screenshots/`):
  - Cámara rechazada → estado `blocked` inmediato (iOS da una sola oportunidad) con "Abrir Ajustes".
  - Tras activar la cámara en Ajustes y volver, la app detectó el permiso sola y mostró la cámara.
  - Ubicación rechazada → la cámara siguió funcionando y la foto se guardó sin coordenadas.
  - Ubicación concedida en Ajustes → coordenadas en vivo con precisión de ±6 m.
- Problema de entorno: Expo Go en iOS exigía la misma cuenta de Expo en el teléfono y en la CLI;
  se resolvió con `npx expo login`.
