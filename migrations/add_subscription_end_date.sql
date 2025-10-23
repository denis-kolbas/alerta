-- Add subscription_end_date to track when canceled subscriptions expire
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS subscription_end_date TIMESTAMP;

-- Add cancel_at_period_end to track if subscription is set to cancel
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT FALSE;

-- Add billing interval and amount
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS billing_interval VARCHAR(20);

ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS billing_amount INTEGER;

-- Add comments
COMMENT ON COLUMN organizations.subscription_end_date IS 'Current period end date - next billing date or cancellation date';
COMMENT ON COLUMN organizations.cancel_at_period_end IS 'Whether subscription is set to cancel at period end';
COMMENT ON COLUMN organizations.billing_interval IS 'Billing frequency: month or year';
COMMENT ON COLUMN organizations.billing_amount IS 'Billing amount in cents';
