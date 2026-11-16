/** Semana 10 (C2): datos del estudiante con los que el servidor arma las instrucciones del tutor. */
export interface Perfil {
  nombre: string;
  tema: Tema;
  nivel: Nivel;
}

export const TEMAS = [
  { value: 'react-native', label: 'React Native' },
  { value: 'supabase', label: 'Supabase' },
  { value: 'sqlite', label: 'SQLite' },
  { value: 'ia', label: 'IA' },
  { value: 'general', label: 'General' },
] as const;
export type Tema = (typeof TEMAS)[number]['value'];

export const NIVELES = [
  { value: 'basico', label: 'Básico' },
  { value: 'intermedio', label: 'Intermedio' },
  { value: 'avanzado', label: 'Avanzado' },
] as const;
export type Nivel = (typeof NIVELES)[number]['value'];

export const PERFIL_INICIAL: Perfil = { nombre: '', tema: 'general', nivel: 'intermedio' };
