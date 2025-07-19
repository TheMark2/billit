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

    const uid = session.user.id;

    // Count total receipts for user
    const { count: totalCount, error: countError } = await supabase
      .from('receipts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', uid);

    if (countError) {
      console.error('Count error:', countError);
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }

    // Get sample receipts
    const { data: sampleReceipts, error: sampleError } = await supabase
      .from('receipts')
      .select('id, proveedor, total, created_at, estado, metadatos')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(3);

    if (sampleError) {
      console.error('Sample error:', sampleError);
      return NextResponse.json({ error: sampleError.message }, { status: 500 });
    }

    return NextResponse.json({
      userId: uid,
      totalCount,
      sampleReceipts: sampleReceipts || [],
      hasReceipts: (totalCount || 0) > 0
    });

  } catch (error) {
    console.error('Debug receipts error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
