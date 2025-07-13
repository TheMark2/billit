import { NextRequest, NextResponse } from 'next/server';
import { supabaseService } from '@/utils/supabaseClient';

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key');
  if (apiKey !== process.env.N8N_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { phoneNumber } = await req.json();
  if (!phoneNumber) {
    return NextResponse.json({ error: 'phoneNumber requerido' }, { status: 400 });
  }

  const supabase = supabaseService();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, is_subscribed, plan_id')
    .eq('phone_number', phoneNumber)
    .single();

  if (error || !data) {
    return NextResponse.json({ isSubscribed: false }, { status: 200 });
  }

  return NextResponse.json({
    isSubscribed: data.is_subscribed,
    userId: data.id,
    planId: data.plan_id,
  });
} 