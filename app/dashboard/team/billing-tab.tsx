'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Loader2 } from 'lucide-react';
import { STRIPE_PLANS } from '@/lib/stripe/plans';

interface BillingTabProps {
  currentPlan?: string;
  subscriptionStatus?: string;
  subscriptionEndDate?: Date | null;
  cancelAtPeriodEnd?: boolean;
  billingInterval?: string | null;
  billingAmount?: number | null;
  currentUserRole?: string;
}

export function BillingTab({ currentPlan, subscriptionStatus, subscriptionEndDate, cancelAtPeriodEnd, billingInterval, billingAmount, currentUserRole }: BillingTabProps) {
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [pricingInterval, setPricingInterval] = useState<'month' | 'year'>('month');

  const canManageBilling = currentUserRole === 'owner' || currentUserRole === 'admin';

  async function handleSubscribe(priceId: string) {
    if (!canManageBilling) return;
    
    setIsLoading(priceId);
    try {
      const response = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      });

      const data = await response.json();
      
      console.log('Checkout response:', data);
      
      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error('No checkout URL returned. Response:', data);
        alert(data.error || 'Failed to create checkout session');
        setIsLoading(null);
      }
    } catch (error) {
      console.error('Error creating checkout:', error);
      alert('Failed to create checkout session');
      setIsLoading(null);
    }
  }

  async function handleManageSubscription() {
    setIsLoading('portal');
    try {
      const response = await fetch('/api/stripe/create-portal', {
        method: 'POST',
      });

      const data = await response.json();
      
      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error('No portal URL returned');
        setIsLoading(null);
      }
    } catch (error) {
      console.error('Error opening portal:', error);
      setIsLoading(null);
    }
  }

  const plans = [
    {
      key: 'free',
      ...STRIPE_PLANS.free,
    },
    {
      key: pricingInterval === 'month' ? 'starter_monthly' : 'starter_yearly',
      ...STRIPE_PLANS[pricingInterval === 'month' ? 'starter_monthly' : 'starter_yearly'],
    },
    {
      key: pricingInterval === 'month' ? 'pro_monthly' : 'pro_yearly',
      ...STRIPE_PLANS[pricingInterval === 'month' ? 'pro_monthly' : 'pro_yearly'],
    },
  ];

  return (
    <div className="space-y-6">
      {/* Current Plan Status */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
          <div>
            <CardTitle>Current Plan</CardTitle>
            <CardDescription>Your organization&apos;s subscription status</CardDescription>
          </div>
          <div className="flex flex-col items-end gap-1">
            {/* Active and renewing */}
            {subscriptionStatus === 'active' && !cancelAtPeriodEnd && (
              <Badge className="bg-green-100 text-green-700 hover:bg-green-200">Active</Badge>
            )}
            
            {/* Canceled but still active */}
            {subscriptionStatus === 'active' && cancelAtPeriodEnd && (
              <Badge className="bg-red-200 text-red-700 hover:bg-red-300">Canceled</Badge>
            )}
            
            {/* Canceled and expired */}
            {subscriptionStatus === 'canceled' && (
              <Badge variant="secondary">Canceled</Badge>
            )}
            
            {/* Free plan */}
            {!subscriptionStatus && (
              <Badge variant="secondary">Free</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-baseline gap-3">
                <p className="text-2xl font-bold">{currentPlan || 'Free'}</p>
                {billingAmount && billingInterval && (
                  <p className="text-lg text-muted-foreground">
                    ${(billingAmount / 100).toFixed(0)}/{billingInterval}
                  </p>
                )}
              </div>
              <div className="mt-1 space-y-1">
                {/* Active and renewing - show next billing */}
                {subscriptionStatus === 'active' && !cancelAtPeriodEnd && subscriptionEndDate && (
                  <p className="text-sm text-muted-foreground">
                    Next billing: {new Date(subscriptionEndDate).toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </p>
                )}
                
                {/* Canceled but still active - show expiry */}
                {subscriptionStatus === 'active' && cancelAtPeriodEnd && subscriptionEndDate && (
                  <p className="text-sm text-muted-foreground">
                    Active until {new Date(subscriptionEndDate).toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </p>
                )}
              </div>
            </div>
            {canManageBilling && subscriptionStatus && (
              <Button 
                onClick={handleManageSubscription}
                disabled={isLoading === 'portal'}
              >
                {isLoading === 'portal' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Manage Subscription
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Billing Interval Toggle */}
      <div className="flex justify-center">
        <div className="inline-flex rounded-lg border p-1">
          <button
            onClick={() => setPricingInterval('month')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              pricingInterval === 'month'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setPricingInterval('year')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              pricingInterval === 'year'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Yearly
            <span className="ml-1 text-xs">(Save 17%)</span>
          </button>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((plan) => (
          <Card key={plan.priceId} className="flex flex-col">
            <CardHeader>
              <CardTitle>{plan.name}</CardTitle>
              <CardDescription>
                <span className="text-3xl font-bold">${plan.price}</span>
                {plan.interval !== 'one-time' && (
                  <span className="text-muted-foreground">/{plan.interval}</span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <ul className="space-y-2">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardContent className="pt-0">
              <Button
                className="w-full"
                variant={plan.name === 'Pro' ? 'default' : 'outline'}
                onClick={() => handleSubscribe(plan.priceId)}
                disabled={!canManageBilling || isLoading === plan.priceId}
              >
                {isLoading === plan.priceId && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {plan.price === 0 ? 'Current Plan' : 'Subscribe'}
              </Button>
              {!canManageBilling && (
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Only owners and admins can manage billing
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
