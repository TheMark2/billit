-- Actualización de precios para 2025
-- Ejecutar en Supabase SQL Editor

-- Actualizar Plan Básico (Gratuito) - aumentar a 10 recibos/mes
UPDATE plans SET 
  limite_recibos = 10,
  updated_at = CURRENT_TIMESTAMP
WHERE nombre = 'Básico';

-- Actualizar Plan Pro Mensual - 150 recibos/mes, 24.99€/mes
UPDATE plans SET 
  limite_recibos = 150,
  precio = 24.99,
  updated_at = CURRENT_TIMESTAMP
WHERE nombre = 'Pro Mensual';

-- Actualizar Plan Pro Anual - 150 recibos/mes, 249.90€/año
UPDATE plans SET 
  limite_recibos = 150,
  precio = 249.90,
  updated_at = CURRENT_TIMESTAMP
WHERE nombre = 'Pro Anual';

-- Actualizar Plan Ultimate Mensual (antes Unlimited) - 1000 recibos/mes, 149.99€/mes
UPDATE plans SET 
  nombre = 'Ultimate Mensual',
  description = 'Plan ultimate mensual con 1000 recibos. Incluye todas las funcionalidades avanzadas.',
  limite_recibos = 1000,
  precio = 149.99,
  updated_at = CURRENT_TIMESTAMP
WHERE nombre = 'Unlimited Mensual';

-- Actualizar Plan Ultimate Anual (antes Unlimited) - 1000 recibos/año, 1499.90€/año
UPDATE plans SET 
  nombre = 'Ultimate Anual',
  description = 'Plan ultimate anual con 1000 recibos. Incluye todas las funcionalidades avanzadas con descuento anual.',
  limite_recibos = 1000,
  precio = 1499.90,
  updated_at = CURRENT_TIMESTAMP
WHERE nombre = 'Unlimited Anual';

-- Insertar nuevo Plan Enterprise Mensual
INSERT INTO plans (
  id,
  nombre,
  description,
  limite_recibos,
  precio,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'Enterprise Mensual',
  'Plan enterprise mensual con 5000 recibos. Para empresas de alto volumen con soporte prioritario.',
  5000,
  499.99,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- Insertar nuevo Plan Enterprise Anual
INSERT INTO plans (
  id,
  nombre,
  description,
  limite_recibos,
  precio,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'Enterprise Anual',
  'Plan enterprise anual con 5000 recibos. Para empresas de alto volumen con descuento anual y soporte prioritario.',
  5000,
  4999.90,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- Verificar todos los cambios
SELECT 
  id,
  nombre,
  description,
  limite_recibos,
  precio,
  created_at,
  updated_at
FROM plans 
ORDER BY 
  CASE 
    WHEN nombre LIKE '%Básico%' THEN 1
    WHEN nombre LIKE '%Pro%' THEN 2
    WHEN nombre LIKE '%Ultimate%' THEN 3
    WHEN nombre LIKE '%Enterprise%' THEN 4
    ELSE 5
  END,
  precio ASC;
