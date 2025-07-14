import { NextRequest, NextResponse } from 'next/server';
import { checkUserSubscription } from '@/utils/supabaseClient';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const phoneNumber = searchParams.get('phone') || '34682788998';

  console.log('🔍 DEBUG - Testeando función checkUserSubscription');
  console.log('📞 Número a probar:', phoneNumber);

  try {
    const userStatus = await checkUserSubscription(phoneNumber);
    
    console.log('✅ Resultado de checkUserSubscription:', userStatus);
    
    // Verificar condición exacta del webhook
    const webhookCondition = !userStatus.isSubscribed || !userStatus.quotaAvailable;
    
    console.log('🔍 Condición del webhook:', {
      isSubscribed: userStatus.isSubscribed,
      quotaAvailable: userStatus.quotaAvailable,
      webhookCondition, // true = envía mensaje de error
      explanation: webhookCondition ? 'ENVIARÁ mensaje de error' : 'NO enviará mensaje de error'
    });

    return NextResponse.json({
      phoneNumber,
      userStatus,
      webhookCondition,
      explanation: webhookCondition ? 'ENVIARÁ mensaje de error' : 'NO enviará mensaje de error',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error en checkUserSubscription:', error);
    
    return NextResponse.json({
      error: 'Error calling checkUserSubscription',
      details: error instanceof Error ? error.message : 'Unknown error',
      phoneNumber,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 