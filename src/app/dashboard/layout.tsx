'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import DashboardNavbar from "@/components/dashboard/DashboardNavbar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        router.replace('/login');
      } else {
        setCheckingSession(false);
      }
    };
    checkAuth();

    // Listener para cambios de sesión
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        router.replace('/login');
      }
    });
    return () => {
      listener?.subscription.unsubscribe();
    };
  }, [router]);

  if (checkingSession) {
    return null; // Podrías renderizar un spinner aquí si lo prefieres
  }

  return (
    <div className="flex h-screen bg-neutral-100">
      <DashboardNavbar />
      <main className="flex-1 p-6 overflow-auto">
        {children}
      </main>
    </div>
  );
}