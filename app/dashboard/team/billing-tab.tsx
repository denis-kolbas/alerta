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



  return (
    <div className="space-y-6">
      {/* Current Plan Status */}
      <Card className="border-border bg-card shadow-sm">
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
          <div className="space-y-6">
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

            {/* What's included section */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold mb-3">What&apos;s included</h4>
              <ul className="grid gap-2 sm:grid-cols-2">
                {(() => {
                  const planKey = currentPlan?.toLowerCase() === 'starter' 
                    ? (billingInterval === 'year' ? 'starter_yearly' : 'starter_monthly')
                    : currentPlan?.toLowerCase() === 'pro'
                    ? (billingInterval === 'year' ? 'pro_yearly' : 'pro_monthly')
                    : 'free';
                  
                  return STRIPE_PLANS[planKey as keyof typeof STRIPE_PLANS].features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span className="text-sm text-muted-foreground">{feature}</span>
                    </li>
                  ));
                })()}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upgrade Cards */}
      {(() => {
        const currentPlanName = currentPlan?.toLowerCase() || 'free';
        
        if (currentPlanName === 'pro') return null;

        const starterKey = pricingInterval === 'month' ? 'starter_monthly' : 'starter_yearly';
        const proKey = pricingInterval === 'month' ? 'pro_monthly' : 'pro_yearly';
        const starterPlan = STRIPE_PLANS[starterKey as keyof typeof STRIPE_PLANS];
        const proPlan = STRIPE_PLANS[proKey as keyof typeof STRIPE_PLANS];

        const starterComparison = [
          { label: 'Integrations', current: '1', next: '3' },
          { label: 'Workspaces', current: '1', next: '3' },
          { label: 'Slack notifications', current: 'No', next: 'Yes' },
          { label: 'Web push notifications', current: 'No', next: 'Yes' },
        ];

        const proComparison = currentPlanName === 'free' ? [
          { label: 'Integrations', current: '1', next: '10' },
          { label: 'Workspaces', current: '1', next: '10' },
          { label: 'Slack notifications', current: 'No', next: 'Yes' },
          { label: 'Web push notifications', current: 'No', next: 'Yes' },
        ] : [
          { label: 'Integrations', current: '3', next: '10' },
          { label: 'Workspaces', current: '3', next: '10' },
        ];

        return (
          <div className="space-y-4">
            {/* Billing Toggle */}
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
                </button>
              </div>
            </div>

            {/* Cards Grid */}
            <div className="grid gap-4 md:grid-cols-2">
              {/* Starter Card */}
              {currentPlanName === 'free' && (
                <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <CardTitle className="flex items-center gap-2">
                        Starter
                      </CardTitle>
                      <div className="text-right">
                        {pricingInterval === 'year' && (
                          <Badge variant="secondary" className="bg-green-100 text-green-700 mb-1">
                            Save {Math.round((1 - (starterPlan.price / (STRIPE_PLANS.starter_monthly.price * 12))) * 100)}%
                          </Badge>
                        )}
                        <div className="text-2xl font-bold">${starterPlan.price}</div>
                        <div className="text-sm text-muted-foreground">/{starterPlan.interval}</div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        {starterComparison.map((row, index) => (
                          <div key={index} className="flex items-center justify-between py-2 border-b last:border-b-0">
                            <span className="text-sm">{row.label}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">{row.current}</span>
                              <span className="text-muted-foreground">→</span>
                              <span className="text-sm font-semibold text-primary">{row.next}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      {canManageBilling && (
                        <Button 
                          className="w-full"
                          variant="outline"
                          onClick={() => handleSubscribe(starterPlan.priceId)}
                          disabled={isLoading === starterPlan.priceId}
                        >
                          {isLoading === starterPlan.priceId && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Upgrade to Starter
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Pro Card */}
              <Card className={`border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 ${currentPlanName === 'starter' ? 'md:col-span-2' : ''}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="flex items-center gap-2">
                      Pro
                      <Badge className="bg-primary">Most Popular</Badge>
                    </CardTitle>
                    <div className="text-right">
                      {pricingInterval === 'year' && (
                        <Badge variant="secondary" className="bg-green-100 text-green-700 mb-1">
                          Save {Math.round((1 - (proPlan.price / (STRIPE_PLANS.pro_monthly.price * 12))) * 100)}%
                        </Badge>
                      )}
                      <div className="text-2xl font-bold">${proPlan.price}</div>
                      <div className="text-sm text-muted-foreground">/{proPlan.interval}</div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      {proComparison.map((row, index) => (
                        <div key={index} className="flex items-center justify-between py-2 border-b last:border-b-0">
                          <span className="text-sm">{row.label}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">{row.current}</span>
                            <span className="text-muted-foreground">→</span>
                            <span className="text-sm font-semibold text-primary">{row.next}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    {canManageBilling && (
                      <Button 
                        className="w-full"
                        onClick={() => handleSubscribe(proPlan.priceId)}
                        disabled={isLoading === proPlan.priceId}
                      >
                        {isLoading === proPlan.priceId && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Upgrade to Pro
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {!canManageBilling && (
              <p className="text-xs text-muted-foreground text-center">
                Only owners and admins can upgrade the plan
              </p>
            )}
          </div>
        );
      })()}


    </div>
  );
}
