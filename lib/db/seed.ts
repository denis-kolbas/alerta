import { stripe } from '../payments/stripe';
import { db } from './drizzle';
import { users, teams, organizations, organizationMembers } from './schema';
import { hashPassword } from '@/lib/auth/session';

async function createStripeProducts() {
  console.log('Creating Stripe products and prices...');

  const baseProduct = await stripe.products.create({
    name: 'Base',
    description: 'Base subscription plan',
  });

  await stripe.prices.create({
    product: baseProduct.id,
    unit_amount: 800, // $8 in cents
    currency: 'usd',
    recurring: {
      interval: 'month',
      trial_period_days: 7,
    },
  });

  const plusProduct = await stripe.products.create({
    name: 'Plus',
    description: 'Plus subscription plan',
  });

  await stripe.prices.create({
    product: plusProduct.id,
    unit_amount: 1200, // $12 in cents
    currency: 'usd',
    recurring: {
      interval: 'month',
      trial_period_days: 7,
    },
  });

  console.log('Stripe products and prices created successfully.');
}

async function seed() {
  const email = 'test@test.com';
  const password = 'admin123';
  const passwordHash = await hashPassword(password);

  const [user] = await db
    .insert(users)
    .values([
      {
        email: email,
        passwordHash: passwordHash,
        role: "owner",
      },
    ])
    .returning();

  console.log('Initial user created.');

  // Create organization
  const [organization] = await db
    .insert(organizations)
    .values({
      name: 'Test Organization',
    })
    .returning();

  console.log('Initial organization created.');

  // Add user to organization
  await db.insert(organizationMembers).values({
    userId: user.id,
    organizationId: organization.id,
    role: 'owner',
  });

  console.log('User added to organization.');

  // Create a workspace in the organization
  const [team] = await db
    .insert(teams)
    .values({
      name: 'Test Workspace',
      organizationId: organization.id,
    })
    .returning();

  console.log('Initial workspace created.');

  await createStripeProducts();
}

seed()
  .catch((error) => {
    console.error('Seed process failed:', error);
    process.exit(1);
  })
  .finally(() => {
    console.log('Seed process finished. Exiting...');
    process.exit(0);
  });
