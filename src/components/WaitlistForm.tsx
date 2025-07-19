'use client';

import { useState } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, CheckCircle } from 'lucide-react';

export default function WaitlistForm() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
  });
  
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!formData.firstName || !formData.lastName || !formData.email) {
      setError('Por favor completa todos los campos');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from('waitlist')
        .insert([
          {
            name: `${formData.firstName} ${formData.lastName}`.trim(),
            email: formData.email,
            source: 'landing_page'
          }
        ]);

      if (error) {
        console.error('Error adding to waitlist:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        setError(`Error al unirse a la lista de espera: ${error.message || 'Error desconocido'}`);
        return;
      }

      setSuccess(true);
      setFormData({
        firstName: '',
        lastName: '',
        email: ''
      });
    } catch (err) {
      console.error('Unexpected error:', {
        error: err,
        message: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined
      });
      setError(`Error inesperado: ${err instanceof Error ? err.message : 'Error desconocido'}`);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
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
              ¡Bienvenido a <br /> <span className="font-bold">billit!</span>
            </h2>
            <p className="text-base md:text-lg lg:text-xl max-w-md hidden sm:block">
              Te notificaremos cuando esté disponible.
            </p>
          </div>
        </div>

        {/* Mensaje de éxito */}
        <main className="flex flex-col items-center justify-center w-full md:w-1/2 p-6 sm:p-10 lg:p-12">
          <div className="w-full max-w-sm sm:max-w-md space-y-6 text-center">
            <div className="flex justify-center">
              <CheckCircle className="w-16 h-16 text-green-500" />
            </div>
            
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
              ¡Perfecto!
            </h1>
            
            <div className="space-y-4">
              <p className="text-lg text-gray-700">
                Te has unido a la lista de espera de <span className="font-semibold">billit</span>
              </p>
              <p className="text-gray-600">
                Te notificaremos cuando esté disponible. Mantente atento a tu email para actualizaciones exclusivas.
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

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
            Gestiona tus <br /> <span className="font-bold">gastos fácilmente.</span>
          </h2>
          <p className="text-base md:text-lg lg:text-xl max-w-md hidden sm:block">
            Únete a la lista de espera y sé de los primeros en acceder.
          </p>
        </div>
      </div>

      {/* Formulario */}
      <main className="flex flex-col items-center justify-center w-full md:w-1/2 p-6 sm:p-10 lg:p-12">
        <form onSubmit={handleSubmit} className="w-full max-w-sm sm:max-w-md space-y-4">
          <h1 className="text-3xl sm:text-4xl font-bold text-center mb-8 tracking-tight text-neutral-800">
            Únete a la lista de espera
          </h1>
          <div className="flex flex-col gap-4 bg-neutral-50 border p-4 rounded-xl">
            <p className="text-sm text-neutral-600 text-start">
              Uniendote a la lista de espera, tendrás  <span className="font-bold text-xl text-black">1 mes gratuito</span> cuando se lance.<br/>
            </p>
          </div>

          {error && <p className="text-sm text-red-600 text-center">{error}</p>}
          <div className="grid grid-cols-2 gap-4">
            <Input
                type="text"
                name="firstName"
                placeholder="Nombre"
                value={formData.firstName}
                onChange={handleInputChange}
                disabled={loading}
                required
            />
            
            <Input
                type="text"
                name="lastName"
                placeholder="Apellido"
                value={formData.lastName}
                onChange={handleInputChange}
                disabled={loading}
                required
            />
          </div>
          <Input
            type="email"
            name="email"
            placeholder="Correo electrónico"
            value={formData.email}
            onChange={handleInputChange}
            disabled={loading}
            required
          />
          
          <Button 
            type="submit" 
            disabled={loading || !formData.email || !formData.firstName || !formData.lastName}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uniéndose a la lista...
              </>
            ) : (
              'Unirse a la lista de espera'
            )}
          </Button>
        </form>
      </main>
    </div>
  );
}
