import Stripe from 'stripe';

// Configuración del cliente de Stripe para el servidor
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

// Función para obtener Stripe en el cliente
export const getStripe = () => {
  if (typeof window !== 'undefined') {
    return import('@stripe/stripe-js').then(({ loadStripe }) =>
      loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)
    );
  }
  return null;
};

// Configuración de precios - REEMPLAZA CON TUS IDs REALES DE STRIPE
export const STRIPE_PRICES = {
  pro: {
    monthly: 'price_1Rlz6SERxI6iQwqij56JD9XF',
    yearly: 'price_1Rlz7QERxI6iQwqiMcERcufk',
  },
  ultimate: {
    monthly: 'price_1Rlz88ERxI6iQwqiMZ4dOzYV',
    yearly: 'price_1RlzApERxI6iQwqi049q8VDZ',
  },
} as const;

// Configuración de planes con detalles completos
export const PLAN_CONFIG = {
  basic: {
    name: 'Básico',
    limits: {
      receipts: 10,
      users: 1,
    },
    features: ['10 recibos/mes', '1 usuario', 'Soporte email'],
    price: 0,
  },
  pro: {
    name: 'Pro',
    limits: {
      receipts: 150,
      users: 5,
    },
    features: [
      '150 recibos/mes', 
      '5 usuarios', 
      'Sincronización ERP',
      'Soporte prioritario',
      'Análisis avanzado de IA'
    ],
    prices: {
      monthly: 24.99,
      yearly: 249.90, // ~17% descuento
    },
  },
  ultimate: {
    name: 'Ultimate',
    limits: {
      receipts: 1000,
      users: -1, // Sin límite
    },
    features: [
      '1000 recibos/mes',
      'Usuarios ilimitados',
      'Integraciones avanzadas',
      'Soporte premium 24/7',
      'API personalizada',
      'Reportes avanzados'
    ],
    prices: {
      monthly: 149.99,
      yearly: 1499.90, // ~17% descuento
    },
  },
} as const;

// Mapeo de precios de Stripe a planes de Supabase
export const STRIPE_TO_SUPABASE_PLAN = {
  // Pro mensual
  'price_1Rlz6SERxI6iQwqij56JD9XF': 'Pro Mensual',
  // Pro anual
  'price_1Rlz7QERxI6iQwqiMcERcufk': 'Pro Anual',
  // Ultimate mensual
  'price_1Rlz88ERxI6iQwqiMZ4dOzYV': 'Ultimate Mensual',
  // Ultimate anual
  'price_1RlzApERxI6iQwqi049q8VDZ': 'Ultimate Anual',
} as const;

// Función para obtener el precio de Stripe por plan y período
export function getStripePrice(planKey: keyof typeof STRIPE_PRICES, period: 'monthly' | 'yearly'): string {
  return STRIPE_PRICES[planKey][period];
}

// Función para obtener configuración del plan
export function getPlanConfig(planKey: keyof typeof PLAN_CONFIG) {
  return PLAN_CONFIG[planKey];
}

// Función para verificar si un precio tiene período de prueba
export function hasTrial(priceId: string): boolean {
  return priceId.includes('pro'); // Todos los planes Pro tienen prueba
}

// Función para obtener el nombre del plan desde un price ID
export function getPlanNameFromPriceId(priceId: string): string | null {
  return STRIPE_TO_SUPABASE_PLAN[priceId as keyof typeof STRIPE_TO_SUPABASE_PLAN] || null;
}

// Función para determinar si un precio es mensual o anual
export function getBillingPeriod(priceId: string): 'monthly' | 'yearly' {
  return priceId.includes('yearly') ? 'yearly' : 'monthly';
}

// Función para obtener el precio base del plan
export function getPlanPrice(planKey: keyof typeof PLAN_CONFIG, period: 'monthly' | 'yearly'): number {
  if (planKey === 'basic') return 0;
  const config = PLAN_CONFIG[planKey];
  return 'prices' in config ? config.prices[period] : 0;
} 