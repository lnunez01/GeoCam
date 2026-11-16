import { AppState } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import { secureStorage } from '@/lib/secureStorage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Faltan EXPO_PUBLIC_SUPABASE_URL o EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY. ' +
      'Copia .env.example como .env, pega los valores y reinicia con `npx expo start -c`.'
  );
}

// Semana 10: el transporte del chat llama a las Edge Functions con fetch propio y necesita estos valores
export const SUPABASE_URL: string = supabaseUrl;
export const SUPABASE_PUBLISHABLE_KEY: string = supabaseKey;

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    // En una app nativa no hay URL de navegador con la sesión
    detectSessionInUrl: false,
  },
});

// El refresco automático del token solo debe correr con la app en primer plano
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
