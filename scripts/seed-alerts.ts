import { db } from '../lib/db/drizzle';
import { alerts, clients } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

async function seedAlerts() {
  try {
    // Get an active client
    const activeClients = await db
      .select()
      .from(clients)
      .where(eq(clients.isActive, true))
      .limit(3);

    if (activeClients.length === 0) {
      console.log('No active clients found. Please connect an integration first.');
      return;
    }

    console.log(`Found ${activeClients.length} active clients`);

    console.log('Client info:', activeClients.map(c => ({ id: c.id, brand: c.brand, integration: c.integrationName })));

    const testAlerts = [
      {
        clientId: activeClients[0].id,
        brandName: activeClients[0].brand || 'Test Brand',
        eventName: 'Order Completed',
        ruleType: 'spike_detection',
        severity: 'warning',
        message: 'Event volume increased by 150% in the last hour',
        metadata: { threshold: 100, actual: 250, timeWindow: '1h' },
        status: 'active' as const,
        isResolved: false,
      },
      {
        clientId: activeClients[0].id,
        brandName: activeClients[0].brand || 'Test Brand',
        eventName: 'User Login',
        ruleType: 'drop_detection',
        severity: 'critical',
        message: 'Event volume dropped by 80% compared to baseline',
        metadata: { threshold: 500, actual: 100, timeWindow: '1h' },
        status: 'active' as const,
        isResolved: false,
      },
      {
        clientId: activeClients[0].id,
        brandName: activeClients[0].brand || 'Test Brand',
        eventName: 'Email Sent',
        ruleType: 'silence_detection',
        severity: 'critical',
        message: 'No events received in the last 2 hours',
        metadata: { lastSeen: '2 hours ago', expectedFrequency: '5 minutes' },
        status: 'active' as const,
        isResolved: false,
      },
      {
        clientId: activeClients[0].id,
        brandName: activeClients[0].brand || 'Test Brand',
        eventName: 'Payment Failed',
        ruleType: 'spike_detection',
        severity: 'warning',
        message: 'Unusual spike in payment failures detected',
        metadata: { threshold: 10, actual: 45, timeWindow: '30m' },
        status: 'resolved' as const,
        isResolved: true,
        resolvedAt: new Date(Date.now() - 3600000), // 1 hour ago
      },
      {
        clientId: activeClients[0].id,
        brandName: activeClients[0].brand || 'Test Brand',
        eventName: 'Cart Abandoned',
        ruleType: 'spike_detection',
        severity: 'info',
        message: 'Cart abandonment rate increased by 25%',
        metadata: { threshold: 100, actual: 125, timeWindow: '1h' },
        status: 'dismissed' as const,
        isResolved: false,
      },
    ];

    // Add more alerts if we have multiple clients
    if (activeClients.length > 1) {
      testAlerts.push(
        {
          clientId: activeClients[1].id,
          brandName: activeClients[1].brand || 'Test Brand',
          eventName: 'Push Notification Sent',
          ruleType: 'drop_detection',
          severity: 'warning',
          message: 'Push notification delivery rate dropped by 40%',
          metadata: { threshold: 1000, actual: 600, timeWindow: '1h' },
          status: 'active' as const,
          isResolved: false,
        },
        {
          clientId: activeClients[1].id,
          brandName: activeClients[1].brand || 'Test Brand',
          eventName: 'SMS Delivered',
          ruleType: 'silence_detection',
          severity: 'critical',
          message: 'No SMS delivery events in the last 3 hours',
          metadata: { lastSeen: '3 hours ago', expectedFrequency: '10 minutes' },
          status: 'active' as const,
          isResolved: false,
        }
      );
    }

    // Insert alerts
    const inserted = await db.insert(alerts).values(testAlerts).returning();

    console.log(`✅ Successfully inserted ${inserted.length} test alerts`);
    console.log('Alert IDs:', inserted.map(a => a.id).join(', '));
  } catch (error) {
    console.error('Error seeding alerts:', error);
  }
}

seedAlerts();
