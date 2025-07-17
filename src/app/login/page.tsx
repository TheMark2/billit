'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
// Solo importar Google y Apple
import { AppleIcon, GoogleIcon } from '@/components/ui/Icons';

export default function LoginPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [step, setStep] = useState(0); // Pasos del registro
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [city, setCity] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setStep(0);
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setFirstName('');
    setLastName('');
    setPhone('');
    setCompany('');
    setCity('');
    setError(null);
  };

  const handleOAuth = async (provider: 'google' | 'github' | 'apple') => {
    setLoading(true);
    
    // Obtener la URL base correcta
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || window.location.origin;
    const redirectTo = `${baseUrl}/auth/callback`;
    
    console.log('🔗 OAuth redirect URL:', redirectTo);
    
    const { error } = await supabase.auth.signInWithOAuth({ 
      provider,
      options: {
        redirectTo: redirectTo
      }
    });
    
    if (error) {
      console.error('❌ OAuth error:', error);
      setError(error.message);
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Manejo de pasos en registro
    if (!isLogin && step < 2) {
      // Validaciones por paso
      if (step === 0 && (!firstName || !lastName)) {
        setError('Por favor completa tu nombre y apellido');
        return;
      }
      if (step === 1 && (!phone || !company || !city)) {
        setError('Por favor completa todos los campos');
        return;
      }
      setStep(step + 1);
      return;
    }

    // Validaciones finales para login o ultimo paso de registro
    if (!email || !password) {
      setError('Por favor completa el email y la contraseña');
      return;
    }
    if (!isLogin && password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const userMetadata = {
          nombre: firstName,
          apellido: lastName,
          telefono: phone,
          ciudad: city,
          empresa: company,
        };
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: userMetadata },
        });
        if (error) throw error;
        if (!data?.user) throw new Error('Error al crear el usuario');
      }
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Renderización por pasos (solo registro)
  const renderStepFields = () => {
    switch (step) {
      case 0:
        return (
          <>
            <Input
              placeholder="Nombre"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              disabled={loading}
            />
            <Input
              placeholder="Apellido"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              disabled={loading}
            />
          </>
        );
      case 1:
        return (
          <>
            <Input
              placeholder="Teléfono (+34 XXX XXX XXX)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={loading}
            />
            <Input
              placeholder="Empresa"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              disabled={loading}
            />
            <Input
              placeholder="Ciudad"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              disabled={loading}
            />
          </>
        );
      case 2:
        return (
          <>
            <Input
              type="email"
              placeholder="Correo electrónico"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
            <Input
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
            <Input
              type="password"
              placeholder="Confirmar contraseña"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
            />
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      {/* Banner */}
      <div className="relative w-full h-56 md:h-auto md:w-1/2 order-1 md:order-none">
        <Image
          src="/Landingimg.png"
          alt="banner"
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-cover"
        />
        <div className="absolute inset-0 flex flex-col justify-center bg-black/40 px-6 md:px-12 text-white">
          <h2 className="text-4xl md:text-5xl lg:text-7xl font-light tracking-tight mb-2 md:mb-4 leading-none">
            Gestiona tus <br /> <span className="font-bold">recibos fácilmente.</span>
          </h2>
          <p className="text-base md:text-lg lg:text-xl max-w-md hidden sm:block">
            Automatiza la extracción y organización de tus recibos en segundos.
          </p>
        </div>
      </div>

      {/* Formulario */}
      <main className="flex flex-col items-center justify-center w-full md:w-1/2 p-6 sm:p-10 lg:p-12">
        <form onSubmit={handleSubmit} className="w-full max-w-sm sm:max-w-md space-y-4">
          <h1 className="text-3xl sm:text-4xl font-semibold text-center mb-8 tracking-tight">
            {isLogin ? 'Iniciar sesión' : 'Crear cuenta'}
          </h1>

          {error && <p className="text-sm text-red-600 text-center">{error}</p>}

          {isLogin ? (
            <>
              <Input
                type="email"
                placeholder="Correo electrónico"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
              <Input
                type="password"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </>
          ) : (
            renderStepFields()
          )}

          {/* Botones de acción */}
          {isLogin ? (
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Cargando...' : 'Iniciar sesión'}
            </Button>
          ) : (
            <div className="flex gap-2">
              {step > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setStep(step - 1)}
                  disabled={loading}
                >
                  Atrás
                </Button>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading
                  ? 'Cargando...'
                  : step < 2
                  ? 'Siguiente'
                  : 'Registrarse'}
              </Button>
            </div>
          )}

          {/* Separador OAuth */}
          <div className="relative pt-6">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-neutral-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-2 text-neutral-500">O continuar con</span>
            </div>
          </div>

          {/* Botones OAuth */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              onClick={() => handleOAuth('google')}
              disabled={loading}
            >
              <GoogleIcon className="w-4 h-4" /> Google
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              onClick={() => handleOAuth('apple')}
              disabled={loading}
            >
              <AppleIcon className="w-4 h-4" /> Apple
            </Button>
          </div>

          {/* Cambio de modo */}
          <p
            className="text-sm text-center text-muted-foreground mt-4 cursor-pointer"
            onClick={() => {
              setIsLogin(!isLogin);
              resetForm();
            }}
          >
            {isLogin ? '¿No tienes una cuenta?' : '¿Ya tienes una cuenta?'}{' '}
            <span className="text-primary font-semibold">
              {isLogin ? 'Regístrate' : 'Inicia sesión'}
            </span>
          </p>
        </form>
      </main>
    </div>
  );
}