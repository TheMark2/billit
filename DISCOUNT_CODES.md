# Códigos de Descuento Disponibles

## 🎯 Códigos Promocionales Creados

Los siguientes códigos de descuento están disponibles en el checkout de Stripe:

### 1. BIENVENIDO20
- **Descuento**: 20% de descuento
- **Tipo**: Una sola vez
- **Descripción**: Descuento de bienvenida para nuevos usuarios

### 2. PROMO50
- **Descuento**: 50% de descuento
- **Tipo**: Una sola vez
- **Descripción**: Promoción especial con 50% de descuento

### 3. DESCUENTO10
- **Descuento**: 10% de descuento
- **Tipo**: Recurrente por 3 meses
- **Descripción**: Descuento continuo por 3 meses

### 4. NUEVOCLIENTE
- **Descuento**: 5€ de descuento
- **Tipo**: Una sola vez
- **Descripción**: Descuento fijo para nuevos clientes

## 💡 Cómo Usar

1. Ve a la página de pricing (`/dashboard/pricing`)
2. Selecciona el plan que deseas
3. Haz clic en "Elegir Plan" 
4. En la página de checkout de Stripe, busca el campo "Código promocional"
5. Introduce uno de los códigos anteriores
6. El descuento se aplicará automáticamente

## 🔧 Configuración Técnica

Los códigos de descuento están habilitados en `src/app/api/stripe/create-checkout-session/route.ts` mediante:

```typescript
allow_promotion_codes: true
```

## 📊 Gestión de Códigos

Para crear nuevos códigos o gestionar los existentes:

1. **Crear cupón**: `stripe coupons create -d percent_off=XX -d duration=once -d name="Nombre del cupón"`
2. **Crear código promocional**: `stripe promotion_codes create -d coupon=COUPON_ID -d code=CODIGO`
3. **Listar códigos**: `stripe promotion_codes list`
4. **Desactivar código**: `stripe promotion_codes update PROMO_CODE_ID -d active=false` 