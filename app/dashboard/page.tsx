import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function DashboardPage() {
  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Welcome</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Get Started</div>
            <p className="text-xs text-muted-foreground">
              View your analytics
            </p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Navigate to your data</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/dashboard/analytics">
            <Button>View Analytics</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}