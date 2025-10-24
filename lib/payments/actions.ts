'use server';

import { redirect } from 'next/navigation';
import { createCustomerPortalSession } from './stripe';
import { withTeam } from '@/lib/auth/middleware';

// Deprecated - now using /api/stripe/create-checkout
// export const checkoutAction = withTeam(async (formData, team) => {
//   const priceId = formData.get('priceId') as string;
//   await createCheckoutSession({ team: team, priceId });
// });

export const customerPortalAction = withTeam(async (_, team) => {
  const portalSession = await createCustomerPortalSession(team);
  // Deprecated function always returns null now
  // Fallback to billing tab
  redirect('/dashboard/team?tab=billing');
});
