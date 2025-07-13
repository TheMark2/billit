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
    monthly: 'price_1RiOAYERxI6iQwqiH8zyLJ8P', // Sin "trial" porque se configura dinámicamente
    yearly: 'price_1RiOElERxI6iQwqiziVsAUqo',   // Sin "trial" porque se configura dinámicamente
  },
  unlimited: {
    monthly: 'price_1RiOBvERxI6iQwqiTHaILsjG',
    yearly: 'price_1RiOEPERxI6iQwqiosO912er',
  },
} as const;

// Configuración de planes con detalles completos
export const PLAN_CONFIG = {
  basic: {
    name: 'Básico',
    limits: {
      receipts: 5,
      users: 1,
    },
    features: ['5 recibos/mes', '1 usuario', 'Soporte email'],
    price: 0,
  },
  pro: {
    name: 'Pro',
    limits: {
      receipts: 100,
      users: 5,
    },
    features: [
      '100 recibos/mes', 
      '5 usuarios', 
      'Sincronización ERP',
      'Soporte prioritario',
      '1 mes de prueba gratis'
    ],
    prices: {
      monthly: 19.99,
      yearly: 199.99, // 10 meses al precio de 12
    },
    trial: {
      days: 30, // 1 mes de prueba
    },
  },
  unlimited: {
    name: 'Unlimited',
    limits: {
      receipts: 2000,
      users: -1, // Sin límite
    },
    features: [
      '2000 recibos/mes',
      'Usuarios ilimitados',
      'Integraciones avanzadas',
      'Soporte premium 24/7',
      'API personalizada'
    ],
    prices: {
      monthly: 49.99,
      yearly: 499.99, // 10 meses al precio de 12
    },
  },
} as const;

// Mapeo de precios de Stripe a planes de Supabase
export const STRIPE_TO_SUPABASE_PLAN = {
  // Pro mensual (con prueba dinámica)
  'price_1RiOAYERxI6iQwqiH8zyLJ8P': 'Pro Mensual',
  // Pro anual (con prueba dinámica)
  'price_1RiOElERxI6iQwqiziVsAUqo': 'Pro Anual',
  // Unlimited mensual
  'price_1RiOBvERxI6iQwqiTHaILsjG': 'Unlimited Mensual',
  // Unlimited anual
  'price_1RiOEPERxI6iQwqiosO912er': 'Unlimited Anual',
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