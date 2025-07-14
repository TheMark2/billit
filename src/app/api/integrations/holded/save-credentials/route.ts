import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { encrypt } from '@/utils/encryption';

const LOG_PREFIX = '🟢 [HOLDED-SAVE]';

export async function POST(request: NextRequest) {
  try {
    const { apiKey, testMode = false } = await request.json();

    console.log(`${LOG_PREFIX} Iniciando guardado de credenciales de Holded...`);

    // Validación mejorada de entrada
    const validationResult = validateInput(apiKey, testMode);
    if (!validationResult.valid) {
      console.log(`${LOG_PREFIX} ❌ Validación fallida: ${validationResult.error}`);
      return NextResponse.json(
        { error: validationResult.error },
        { status: 400 }
      );
    }

    // Validar y obtener usuario autenticado
    const authResult = await validateAndGetUser(request);
    if (!authResult.success) {
      console.log(`${LOG_PREFIX} ❌ Error de autenticación: ${authResult.error}`);
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.statusCode || 401 }
      );
    }

    const { user, supabase } = authResult;

    // Verificar que el API key funciona antes de guardarlo
    console.log(`${LOG_PREFIX} Verificando API Key antes de guardar...`);
    const testResult = await testHoldedApiKey(apiKey.trim());
    
    if (!testResult.success) {
      console.log(`${LOG_PREFIX} ❌ API Key inválida: ${testResult.error}`);
      return NextResponse.json(
        { error: `API Key inválida: ${testResult.error}` },
        { status: 400 }
      );
    }

    console.log(`${LOG_PREFIX} ✅ API Key verificada exitosamente`);

    // Encriptar y guardar credenciales
    const saveResult = await saveCredentials(supabase, user.id, apiKey.trim(), testMode);
    
    if (!saveResult.success) {
      console.log(`${LOG_PREFIX} ❌ Error guardando: ${saveResult.error}`);
      return NextResponse.json(
        { error: saveResult.error },
        { status: 500 }
      );
    }

    console.log(`${LOG_PREFIX} ✅ Credenciales guardadas exitosamente`);

    return NextResponse.json({
      success: true,
      message: 'Credenciales de Holded guardadas exitosamente',
      test_mode: testMode,
      api_key_preview: `${apiKey.substring(0, 8)}...`,
      connection_verified: true,
      saved_at: new Date().toISOString()
    });

  } catch (error) {
    console.error(`${LOG_PREFIX} Error interno:`, error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// Función auxiliar para validar entrada
function validateInput(apiKey: any, testMode: any): { valid: boolean; error?: string } {
  // Validar API Key
  if (!apiKey) {
    return { valid: false, error: 'API key es requerida' };
  }

  if (typeof apiKey !== 'string') {
    return { valid: false, error: 'API key debe ser una cadena de texto' };
  }

  if (apiKey.trim().length === 0) {
    return { valid: false, error: 'API key no puede estar vacía' };
  }

  if (apiKey.trim().length < 10) {
    return { valid: false, error: 'API key parece ser demasiado corta' };
  }

  // Validar modo de prueba
  if (typeof testMode !== 'boolean') {
    return { valid: false, error: 'testMode debe ser un valor booleano' };
  }

  return { valid: true };
}

// Función auxiliar para validar usuario y obtener cliente autenticado
async function validateAndGetUser(request: NextRequest): Promise<any> {
  const LOG_PREFIX = '🟢 [HOLDED-SAVE]';
  
  try {
    // Obtener token de autorización
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        success: false,
        error: 'Token de autorización requerido',
        statusCode: 401
      };
    }

    const token = authHeader.substring(7);

    // Crear cliente autenticado con el token del usuario
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    );

    // Verificar el usuario con Supabase
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      console.log(`${LOG_PREFIX} Error de autenticación:`, authError);
      return {
        success: false,
        error: 'Token de autorización inválido',
        statusCode: 401
      };
    }

    if (!user) {
      return {
        success: false,
        error: 'Usuario no encontrado',
        statusCode: 401
      };
    }

    return {
      success: true,
      user,
      supabase
    };

  } catch (error) {
    console.error(`${LOG_PREFIX} Error validando usuario:`, error);
    return {
      success: false,
      error: 'Error de autenticación',
      statusCode: 500
    };
  }
}

// Función auxiliar para probar API Key de Holded
async function testHoldedApiKey(apiKey: string): Promise<{ success: boolean; error?: string }> {
  const LOG_PREFIX = '🟢 [HOLDED-SAVE]';
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 segundos

    // Probar endpoint básico de contactos (más rápido que documentos)
    const response = await fetch('https://api.holded.com/api/invoicing/v1/contacts', {
      method: 'GET',
      headers: {
        'key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.status === 401) {
      return { success: false, error: 'API key inválida o sin permisos' };
    }

    if (response.status === 403) {
      return { success: false, error: 'Acceso denegado - verifica los permisos de tu API key' };
    }

    if (!response.ok) {
      return { success: false, error: `Error del servidor de Holded (${response.status})` };
    }

    // Verificar que la respuesta es JSON válido
    const responseText = await response.text();
    
    if (!responseText.trim()) {
      return { success: false, error: 'Respuesta vacía del servidor' };
    }

    try {
      JSON.parse(responseText);
    } catch {
      return { success: false, error: 'Respuesta inválida del servidor' };
    }

    console.log(`${LOG_PREFIX} API Key verificada exitosamente`);
    return { success: true };

  } catch (error: any) {
    console.log(`${LOG_PREFIX} Error probando API Key:`, error.message);
    
    if (error.name === 'AbortError') {
      return { success: false, error: 'Timeout verificando API key' };
    }

    return { success: false, error: 'Error de conexión con Holded' };
  }
}

// Función auxiliar para guardar credenciales
async function saveCredentials(
  supabase: any, 
  userId: string, 
  apiKey: string, 
  testMode: boolean
): Promise<{ success: boolean; error?: string }> {
  const LOG_PREFIX = '🟢 [HOLDED-SAVE]';
  
  try {
    // Encriptar el API key
    const encryptedApiKey = encrypt(apiKey);

    // Iniciar transacción: desactivar credenciales existentes
    const { error: updateError } = await supabase
      .from('holded_credentials')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    if (updateError) {
      console.error(`${LOG_PREFIX} Error desactivando credenciales existentes:`, updateError);
      return { success: false, error: 'Error actualizando credenciales existentes' };
    }

    // Insertar las nuevas credenciales
    const { error: insertError } = await supabase
      .from('holded_credentials')
      .insert({
        user_id: userId,
        api_key: encryptedApiKey,
        test_mode: testMode,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (insertError) {
      console.error(`${LOG_PREFIX} Error insertando credenciales:`, insertError);
      return { success: false, error: 'Error guardando nuevas credenciales' };
    }

    return { success: true };

  } catch (error) {
    console.error(`${LOG_PREFIX} Error en saveCredentials:`, error);
    return { success: false, error: 'Error procesando credenciales' };
  }
} 