import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET() {
  try {
    const supabase = createClient();
    
    // Get current user
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No authenticated user' }, { status: 401 });
    }

    // Get a sample receipt to see available columns
    const { data: sampleReceipt, error } = await supabase
      .from('receipts')
      .select('*')
      .eq('user_id', session.user.id)
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      console.error('Sample receipt error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      userId: session.user.id,
      sampleReceipt,
      availableColumns: sampleReceipt ? Object.keys(sampleReceipt) : [],
      hasData: !!sampleReceipt
    });

  } catch (error) {
    console.error('Debug table structure error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
