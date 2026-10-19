import { Redirect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

// Queda fuera de los grupos protegidos: decide a dónde ir según la sesión
export default function Index() {
  const { session } = useAuth();
  return <Redirect href={session ? '/geocam' : '/login'} />;
}
