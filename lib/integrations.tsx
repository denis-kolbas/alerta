import Image from 'next/image';

export interface IntegrationConfig {
  id: string;
  name: string;
  description: string;
  category: string;
  href: string | null;
  // Image paths (store in public/integrations/)
  icon: string; // Large icon for cards (e.g., /integrations/braze-icon.svg)
  favicon: string; // Small favicon for tables (e.g., /integrations/braze-favicon.svg)
}

export const INTEGRATIONS: Record<string, IntegrationConfig> = {
  braze: {
    id: 'braze',
    name: 'Braze',
    description: 'Customer engagement platform for personalized messaging across channels',
    category: 'Marketing Automation',
    href: '/dashboard/integrations/braze',
    icon: '/integrations/braze-icon.png',
    favicon: '/integrations/braze-favicon.png',
  },
  klaviyo: {
    id: 'klaviyo',
    name: 'Klaviyo',
    description: 'Email and SMS marketing platform for ecommerce businesses',
    category: 'Email Marketing',
    href: '/dashboard/integrations/klaviyo',
    icon: '/integrations/klaviyo-icon.png',
    favicon: '/integrations/klaviyo-favicon.png',
  },
  mixpanel: {
    id: 'mixpanel',
    name: 'Mixpanel',
    description: 'Product analytics platform to understand user behavior and drive engagement',
    category: 'Analytics',
    href: null,
    icon: '/integrations/mixpanel-icon.svg',
    favicon: '/integrations/mixpanel-favicon.svg',
  },
  'google-analytics': {
    id: 'google-analytics',
    name: 'Google Analytics',
    description: 'Web analytics service that tracks and reports website traffic and user behavior',
    category: 'Analytics',
    href: '/dashboard/integrations/google-analytics',
    icon: '/integrations/google-analytics-icon.png',
    favicon: '/integrations/google-analytics-favicon.png',
  },
};

// Helper components for consistent rendering
export function IntegrationIcon({ 
  integrationId, 
  size = 'default' 
}: { 
  integrationId: string; 
  size?: 'small' | 'default' | 'large';
}) {
  const integration = INTEGRATIONS[integrationId];
  if (!integration) return <span>📦</span>;

  const dimensions = {
    small: { width: 16, height: 16 },
    default: { width: 40, height: 40 },
    large: { width: 64, height: 64 },
  };

  const { width, height } = dimensions[size];

  return (
    <Image
      src={integration.icon}
      alt={`${integration.name} logo`}
      width={width}
      height={height}
      className="rounded"
    />
  );
}

export function IntegrationFavicon({ integrationId }: { integrationId: string }) {
  const integration = INTEGRATIONS[integrationId];
  if (!integration) return <span className="text-xs">📦</span>;

  return (
    <Image
      src={integration.favicon}
      alt={`${integration.name} icon`}
      width={16}
      height={16}
      className="rounded"
    />
  );
}

// Fallback for when images aren't available yet
export function IntegrationEmoji({ integrationId }: { integrationId: string }) {
  const emojis: Record<string, string> = {
    braze: '🔥',
    klaviyo: '✉️',
    mixpanel: '📊',
    segment: '🎯',
  };
  return <span className="text-2xl">{emojis[integrationId] || '📦'}</span>;
}
