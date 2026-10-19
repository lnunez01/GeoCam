// Cliente único de Supabase para toda la app.
import { AppState } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import { secureStorage } from './secureStorage';

// Solo la URL y la publishable key: quedan dentro del bundle y son públicas.
// La seguridad la ponen las políticas RLS, no esconder estas llaves.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error('Faltan EXPO_PUBLIC_SUPABASE_URL o EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY en .env');
}

export const supabase = createClient(url, key, {
  auth: {
    storage: secureStorage, // sesión cifrada (Keychain / Keystore), no AsyncStorage
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // no hay URL de navegador en una app nativa
  },
});

// El token solo se refresca mientras la app está en primer plano
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
