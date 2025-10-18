/**
 * Populate sample alerts for testing
 * Run with: npx tsx scripts/populate-sample-alerts.ts
 */

import { db } from '../lib/db/drizzle';
import { alerts, clients } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

async function populateSampleAlerts() {
  console.log('🔄 Creating sample alerts...\n');

  // Get the client ID for Bark
  const barkClient = await db
    .select()
    .from(clients)
    .where(eq(clients.brandName, 'Bark'))
    .limit(1);

  if (barkClient.length === 0) {
    console.error('❌ Client "Bark" not found in database');
    console.log('Please create a client first or change the brand name');
    return;
  }

  const clientId = barkClient[0].id;
  console.log(`✓ Found client: Bark (${clientId})\n`);

  const sampleAlerts = [
    {
      clientId,
      brandName: 'Bark',
      eventName: 'session.start',
      ruleType: 'silence_detection',
      severity: 'critical',
      message: 'session.start has been silent for 8 hours (typical max: 4h)',
      metadata: {
        current_silence_hours: 8,
        baseline_max_silence_hours: 4,
        multiplier: 2.0
      },
      isResolved: false,
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    },
    {
      clientId,
      brandName: 'Bark',
      eventName: 'purchase.complete',
      ruleType: 'spike_detection',
      severity: 'warning',
      message: 'purchase.complete spike detected: 5000 events (normal: 1200)',
      metadata: {
        current_count: 5000,
        baseline_avg: 1200,
        baseline_stddev: 300,
        threshold: 2100,
        stddev_multiplier: 12.67
      },
      isResolved: false,
      createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
    },
    {
      clientId,
      brandName: 'Bark',
      eventName: 'email.open',
      ruleType: 'drop_detection',
      severity: 'warning',
      message: 'email.open drop detected: 50 events (normal: 800)',
      metadata: {
        current_count: 50,
        baseline_avg: 800,
        baseline_stddev: 150,
        threshold: 350,
        stddev_multiplier: 5.0
      },
      isResolved: false,
      createdAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
    },
    {
      clientId,
      brandName: 'Bark',
      eventName: 'session.end',
      ruleType: 'silence_detection',
      severity: 'warning',
      message: 'session.end has been silent for 6 hours (typical max: 3h)',
      metadata: {
        current_silence_hours: 6,
        baseline_max_silence_hours: 3,
        multiplier: 2.0
      },
      isResolved: true,
      resolvedAt: new Date(Date.now() - 10 * 60 * 1000), // Resolved 10 minutes ago
      createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000), // Created 6 hours ago
    },
    {
      clientId,
      brandName: 'Bark',
      eventName: 'push.sent',
      ruleType: 'spike_detection',
      severity: 'warning',
      message: 'push.sent spike detected: 15000 events (normal: 3000)',
      metadata: {
        current_count: 15000,
        baseline_avg: 3000,
        baseline_stddev: 500,
        threshold: 4500,
        stddev_multiplier: 24.0
      },
      isResolved: true,
      resolvedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // Resolved 2 hours ago
      createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000), // Created 12 hours ago
    },
  ];

  for (const alert of sampleAlerts) {
    const result = await db.insert(alerts).values(alert).returning();
    console.log(`✅ Created ${alert.ruleType} alert for ${alert.eventName} (ID: ${result[0].id})`);
  }

  console.log('\n🎉 Sample alerts created successfully!');
  console.log('\nSummary:');
  console.log('- 3 unresolved alerts');
  console.log('- 2 resolved alerts');
  console.log('- Mix of silence, spike, and drop detections');
}

populateSampleAlerts()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
