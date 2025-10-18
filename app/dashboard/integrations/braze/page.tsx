import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BrazeIntegrationForm } from '@/components/braze-integration-form';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function BrazeIntegrationPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/integrations">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Braze Integration</h1>
          <p className="text-muted-foreground mt-2">
            Connect your Braze account to sync customer engagement data
          </p>
        </div>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
          <CardDescription>
            Enter your Braze instance URL and API key to establish the connection
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BrazeIntegrationForm />
        </CardContent>
      </Card>
    </div>
  );
}
