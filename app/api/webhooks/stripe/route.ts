import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe } from '@/lib/payments/stripe';
import { db } from '@/lib/db/drizzle';
import { organizations } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import Stripe from 'stripe';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = (await headers()).get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not set');
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const organizationId = session.metadata?.organizationId;
        const customerId = session.customer as string;

        console.log('=== CHECKOUT SESSION COMPLETED ===');
        console.log('Organization ID:', organizationId);
        console.log('Customer ID:', customerId);

        if (!organizationId) {
          console.error('No organizationId in session metadata');
          break;
        }

        if (!customerId) {
          console.error('No customer ID in session');
          break;
        }

        // Update organization with customer ID immediately
        await db
          .update(organizations)
          .set({
            stripeCustomerId: customerId,
            updatedAt: new Date(),
          })
          .where(eq(organizations.id, parseInt(organizationId)));

        console.log('✅ Updated organization with customer ID');
        console.log('=== END CHECKOUT SESSION ===\n');

        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        try {
          const subscription = event.data.object as Stripe.Subscription;
          const customerId = subscription.customer as string;

          console.log('=== SUBSCRIPTION EVENT ===');
          console.log('Event type:', event.type);
          console.log('Subscription ID:', subscription.id);
          console.log('Customer ID:', customerId);

          // Find organization by customer ID OR by subscription metadata
          let org = await db
            .select()
            .from(organizations)
            .where(eq(organizations.stripeCustomerId, customerId))
            .limit(1);

          // If not found by customer ID, try to find by subscription metadata
          if (!org[0] && subscription.metadata?.organizationId) {
            console.log('Organization not found by customer ID, trying metadata...');
            org = await db
              .select()
              .from(organizations)
              .where(eq(organizations.id, parseInt(subscription.metadata.organizationId)))
              .limit(1);
            
            // If found, update with customer ID
            if (org[0]) {
              console.log('Found organization by metadata, updating customer ID...');
              await db
                .update(organizations)
                .set({
                  stripeCustomerId: customerId,
                  updatedAt: new Date(),
                })
                .where(eq(organizations.id, org[0].id));
            }
          }

          if (!org[0]) {
            console.error('❌ Organization not found for customer:', customerId);
            break;
          }

          console.log('Found organization:', org[0].id, org[0].name);

        // Fetch full subscription details from Stripe (webhook data might be incomplete)
        const fullSubscription = await stripe.subscriptions.retrieve(subscription.id, {
          expand: ['items.data.price']
        });

        console.log('Full subscription retrieved from Stripe API');

        // Get price details
        const priceId = fullSubscription.items.data[0]?.price.id;
        const productId = fullSubscription.items.data[0]?.price.product as string;

        // Determine plan name based on price ID
        let planName = 'Free';
        if (priceId === 'price_1SLNwlAtySMHx8WMPkQ97Dwt' || priceId === 'price_1SLNwlAtySMHx8WM8OcSHwan') {
          planName = 'Starter';
        } else if (priceId === 'price_1SLO8cAtySMHx8WMhGYEGt2M' || priceId === 'price_1SLO8xAtySMHx8WM7JkY1m2W') {
          planName = 'Pro';
        }

        // Get billing details
        // Get period end from subscription items (where it actually lives)
        const currentPeriodEnd = fullSubscription.items.data[0]?.current_period_end;
        const cancelAt = (fullSubscription as unknown as { cancel_at: number | null }).cancel_at;
        const cancelAtPeriodEnd = (fullSubscription as unknown as { cancel_at_period_end: boolean }).cancel_at_period_end;
        
        // Use cancel_at if subscription is cancelled, otherwise use current_period_end
        const subscriptionEndDate = (cancelAt || currentPeriodEnd) 
          ? new Date((cancelAt || currentPeriodEnd) * 1000)
          : null;

        // Get billing details
        const price = fullSubscription.items.data[0]?.price;
        const billingInterval = price?.recurring?.interval || null;
        const billingAmount = price?.unit_amount || null;

        // Log the subscription data
        console.log('Extracted subscription data:', {
          id: fullSubscription.id,
          status: fullSubscription.status,
          current_period_end: currentPeriodEnd,
          cancel_at: cancelAt,
          cancel_at_period_end: cancelAtPeriodEnd,
          final_end_date: subscriptionEndDate?.toISOString()
        });

        // Update organization subscription
        await db
          .update(organizations)
          .set({
            stripeSubscriptionId: fullSubscription.id,
            stripeProductId: productId,
            planName,
            subscriptionStatus: fullSubscription.status,
            subscriptionEndDate,
            cancelAtPeriodEnd: cancelAtPeriodEnd || false,
            billingInterval,
            billingAmount,
            updatedAt: new Date(),
          })
          .where(eq(organizations.id, org[0].id));

          console.log('✅ Successfully updated organization with subscription data');
          console.log('Saved end date:', subscriptionEndDate?.toISOString());
          console.log('=== END SUBSCRIPTION EVENT ===\n');
        } catch (error) {
          console.error('❌ Error processing subscription event:', error);
          throw error;
        }

        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        // Find organization by customer ID
        const org = await db
          .select()
          .from(organizations)
          .where(eq(organizations.stripeCustomerId, customerId))
          .limit(1);

        if (!org[0]) {
          console.error('Organization not found for customer:', customerId);
          break;
        }

        // Downgrade to free plan
        await db
          .update(organizations)
          .set({
            stripeSubscriptionId: null,
            stripeProductId: null,
            planName: 'Free',
            subscriptionStatus: 'canceled',
            updatedAt: new Date(),
          })
          .where(eq(organizations.id, org[0].id));


        break;
      }

      default:
        console.log('Unhandled event type:', event.type);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
