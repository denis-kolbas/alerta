-- Create alerts table for anomaly detection
CREATE TABLE IF NOT EXISTS alerts (
  id SERIAL PRIMARY KEY,
  brand_name TEXT NOT NULL,
  event_name TEXT NOT NULL,
  rule_type VARCHAR(50) NOT NULL, -- 'silence_detection', 'spike_detection', 'drop_detection'
  severity VARCHAR(20) NOT NULL, -- 'critical', 'warning', 'info'
  message TEXT NOT NULL,
  metadata JSONB, -- Store detection details (thresholds, current values, etc.)
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMP,
  is_resolved BOOLEAN NOT NULL DEFAULT FALSE
);

-- Indexes for efficient queries
CREATE INDEX idx_alerts_brand_event ON alerts(brand_name, event_name);
CREATE INDEX idx_alerts_unresolved ON alerts(is_resolved, created_at DESC);
CREATE INDEX idx_alerts_rule_type ON alerts(rule_type);

-- Comments for documentation
COMMENT ON TABLE alerts IS 'Stores anomaly detection alerts for event data';
COMMENT ON COLUMN alerts.metadata IS 'JSON object containing rule-specific data like thresholds, baseline values, etc.';
