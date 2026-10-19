// Estado de la sesión de Supabase disponible para toda la app.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface AuthValue {
  session: Session | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Se dispara al suscribirse (con la sesión guardada) y en cada login, logout o refresco
    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setIsLoading(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const value: AuthValue = {
    session,
    isLoading,
    // Devuelven el mensaje de error para la UI, o null si todo salió bien
    signIn: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      return error ? translateError(error.message) : null;
    },
    signUp: async (email, password) => {
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
      if (error) return translateError(error.message);
      return data.session ? null : 'Revisa tu correo para confirmar la cuenta.';
    },
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}

// Mensajes de Supabase Auth más comunes, en español para el usuario
function translateError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Correo o contraseña incorrectos.';
  if (m.includes('already registered')) return 'Ya existe una cuenta con ese correo.';
  if (m.includes('email not confirmed')) return 'Debes confirmar tu correo antes de entrar.';
  if (m.includes('invalid') && m.includes('email')) return 'El correo no es válido.';
  if (m.includes('password')) return 'La contraseña debe tener al menos 6 caracteres.';
  if (m.includes('network') || m.includes('fetch')) return 'Sin conexión. Revisa tu internet.';
  return message;
}
