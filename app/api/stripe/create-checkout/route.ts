import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { organizationMembers, organizations } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { stripe } from '@/lib/payments/stripe';

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { priceId } = await request.json();

    if (!priceId) {
      return NextResponse.json({ error: 'Price ID required' }, { status: 400 });
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

    if (!org[0]) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 400 });
    }

    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      customer: org[0].stripeCustomerId || undefined,
      customer_email: org[0].stripeCustomerId ? undefined : user.email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${baseUrl}/dashboard/team?tab=billing&success=true`,
      cancel_url: `${baseUrl}/dashboard/team?tab=billing&canceled=true`,
      metadata: {
        organizationId: org[0].id.toString(),
        userId: user.id.toString(),
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
