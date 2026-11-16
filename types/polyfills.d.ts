// react-native no publica tipos para este archivo interno; se declara a mano.
declare module 'react-native/Libraries/Utilities/PolyfillFunctions' {
  export function polyfillGlobal<T>(name: string, getValue: () => T): void;
}

// @ungap/structured-clone no trae tipos: es la misma firma que structuredClone del navegador.
declare module '@ungap/structured-clone' {
  const structuredClone: <T>(value: T) => T;
  export default structuredClone;
}
