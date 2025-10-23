export const STRIPE_PLANS = {
  free: {
    name: 'Free',
    price: 0,
    priceId: 'price_1SLO7pAtySMHx8WMro7nxmTJ',
    interval: 'one-time',
    features: [
      '1 integration',
      'Basic monitoring',
      'Email alerts',
      'Community support',
    ],
  },
  starter_monthly: {
    name: 'Starter',
    price: 29,
    priceId: 'price_1SLNwlAtySMHx8WMPkQ97Dwt',
    interval: 'month',
    features: [
      '3 integrations',
      'Advanced monitoring',
      'Email & Slack alerts',
      'Priority support',
      'Custom alert rules',
    ],
  },
  starter_yearly: {
    name: 'Starter',
    price: 199,
    priceId: 'price_1SLNwlAtySMHx8WM8OcSHwan',
    interval: 'year',
    features: [
      '3 integrations',
      'Advanced monitoring',
      'Email & Slack alerts',
      'Priority support',
      'Custom alert rules',
      '2 months free',
    ],
  },
  pro_monthly: {
    name: 'Pro',
    price: 99,
    priceId: 'price_1SLO8cAtySMHx8WMhGYEGt2M',
    interval: 'month',
    features: [
      '10 integrations',
      'Advanced monitoring',
      'All alert channels',
      'Priority support',
      'Custom alert rules',
      'API access',
      'Advanced analytics',
    ],
  },
  pro_yearly: {
    name: 'Pro',
    price: 799,
    priceId: 'price_1SLO8xAtySMHx8WM7JkY1m2W',
    interval: 'year',
    features: [
      '10 integrations',
      'Advanced monitoring',
      'All alert channels',
      'Priority support',
      'Custom alert rules',
      'API access',
      'Advanced analytics',
      '2 months free',
    ],
  },
} as const;

export type PlanKey = keyof typeof STRIPE_PLANS;
