import { NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { organizationMembers, organizations } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { stripe } from '@/lib/payments/stripe';

export async function POST() {
  try {
    const user = await getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's organization
    const orgMembership = await db
      .select({
        organizationId: organizationMembers.organizationId,
        role: organizationMembers.role,
      })
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, user.id))
      .limit(1);

    if (!orgMembership[0]) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 });
    }

    // Only owners and admins can manage billing
    if (orgMembership[0].role !== 'owner' && orgMembership[0].role !== 'admin') {
      return NextResponse.json({ error: 'Only owners and admins can manage billing' }, { status: 403 });
    }

    // Get organization details
    const org = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgMembership[0].organizationId))
      .limit(1);

    if (!org[0] || !org[0].stripeCustomerId) {
      return NextResponse.json({ error: 'No subscription found' }, { status: 400 });
    }

    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

    // Create portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: org[0].stripeCustomerId,
      return_url: `${baseUrl}/dashboard/team?tab=billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Error creating portal session:', error);
    return NextResponse.json(
      { error: 'Failed to create portal session' },
      { status: 500 }
    );
  }
}
