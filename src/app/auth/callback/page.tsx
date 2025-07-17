'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('Procesando autenticación...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        console.log('🔄 Iniciando callback de autenticación...');
        console.log('🔗 URL actual:', window.location.href);
        console.log('📋 Search params:', Object.fromEntries(searchParams.entries()));

        // Verificar si hay errores en los parámetros de URL
        const errorParam = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');
        
        if (errorParam) {
          console.error('❌ Error en URL:', errorParam, errorDescription);
          setError(`Error de autenticación: ${errorDescription || errorParam}`);
          setTimeout(() => router.push('/login?error=auth_failed'), 3000);
          return;
        }

        // Esperar un poco para que la URL se procese completamente
        await new Promise(resolve => setTimeout(resolve, 1000));

        setStatus('Obteniendo sesión...');
        
        // Intentar obtener la sesión actual
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        
        console.log('📊 Datos de sesión:', sessionData);
        console.log('❌ Error de sesión:', sessionError);

        if (sessionError) {
          console.error('❌ Error al obtener sesión:', sessionError);
          setError(`Error de sesión: ${sessionError.message}`);
          setTimeout(() => router.push('/login?error=session_failed'), 3000);
          return;
        }

        if (sessionData?.session?.user) {
          console.log('✅ Usuario autenticado:', sessionData.session.user);
          setStatus('Usuario autenticado, verificando perfil...');
          
          // Verificar si el usuario tiene un perfil
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', sessionData.session.user.id)
            .single();

          console.log('👤 Perfil del usuario:', profile);
          console.log('❌ Error de perfil:', profileError);

          if (profileError && profileError.code !== 'PGRST116') {
            console.error('❌ Error al verificar perfil:', profileError);
            setError(`Error al verificar perfil: ${profileError.message}`);
            setTimeout(() => router.push('/login?error=profile_failed'), 3000);
            return;
          }

          if (!profile) {
            console.log('⚠️ Perfil no encontrado, creando...');
            setStatus('Creando perfil de usuario...');
            
            // Intentar crear el perfil manualmente
            const userData = sessionData.session.user;
            const fullName = userData.user_metadata?.full_name || '';
            const nameParts = fullName.split(' ');
            
            const { error: createError } = await supabase
              .from('profiles')
              .insert({
                id: userData.id,
                email: userData.email,
                nombre: userData.user_metadata?.name || nameParts[0] || 'Usuario',
                apellido: nameParts.slice(1).join(' ') || '',
                is_subscribed: false,
                recibos_mes_actual: 0
              });

            if (createError) {
              console.error('❌ Error al crear perfil:', createError);
              setError(`Error al crear perfil: ${createError.message}`);
              setTimeout(() => router.push('/login?error=profile_creation_failed'), 3000);
              return;
            }
            
            console.log('✅ Perfil creado exitosamente');
          }

          setStatus('Redirigiendo al dashboard...');
          router.push('/dashboard');
        } else {
          console.log('⚠️ No hay sesión, intentando obtener usuario...');
          setStatus('Verificando usuario...');
          
          // Intentar obtener el usuario directamente
          const { data: userData, error: userError } = await supabase.auth.getUser();
          
          console.log('👤 Datos de usuario:', userData);
          console.log('❌ Error de usuario:', userError);

          if (userError || !userData?.user) {
            console.error('❌ No se pudo obtener el usuario:', userError);
            setError('No se pudo completar la autenticación');
            setTimeout(() => router.push('/login?error=user_not_found'), 3000);
            return;
          }

          console.log('✅ Usuario obtenido, redirigiendo...');
          router.push('/dashboard');
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
        console.error('❌ Error general en callback:', err);
        setError(`Error inesperado: ${errorMessage}`);
        setTimeout(() => router.push('/login?error=unexpected'), 3000);
      }
    };

    handleAuthCallback();
  }, [router, searchParams]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error de Autenticación</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <p className="text-sm text-gray-500">Serás redirigido al login en unos segundos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <h1 className="text-2xl font-bold mb-2">Autenticando...</h1>
        <p className="text-gray-600">{status}</p>
      </div>
    </div>
  );
}

export default function AuthCallback() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h1 className="text-2xl font-bold mb-2">Cargando...</h1>
          <p className="text-gray-600">Preparando autenticación...</p>
        </div>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  );
}