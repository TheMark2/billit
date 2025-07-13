'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirigir a la página de login, el usuario puede alternar entre login y registro allí
    router.push('/login');
  }, [router]);

  // Mostrar un mensaje mientras se redirige
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h2 className="text-xl font-semibold">Redirigiendo...</h2>
        <p className="text-gray-600">Serás redirigido a la página de login donde puedes registrarte.</p>
      </div>
    </div>
  );
} 