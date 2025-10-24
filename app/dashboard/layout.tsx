'use client';

import { useState, useEffect } from 'react';
import { AppSidebar } from '@/components/app-sidebar';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { SupportModal } from '@/components/support-modal';
import { FeedbackModal } from '@/components/feedback-modal';
import { AlertProvider } from '@/lib/contexts/alert-context';
import { Headphones, MessageSquare } from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [supportOpen, setSupportOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    // Fetch user email
    fetch('/api/user')
      .then(res => res.json())
      .then(data => setUserEmail(data.email || ''))
      .catch(err => console.error('Failed to fetch user:', err));
  }, []);

  return (
    <AlertProvider>
      <SidebarProvider>
        <div className="flex min-h-screen w-full">
          <AppSidebar />
          <main className="flex-1">
          <div className="border-b">
            <div className="flex h-16 items-center justify-between px-6">
              <SidebarTrigger />
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFeedbackOpen(true)}
                  className="gap-2"
                >
                  <MessageSquare className="h-4 w-4" />
                  Feedback
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSupportOpen(true)}
                  className="gap-2"
                >
                  <Headphones className="h-4 w-4" />
                  Support
                </Button>
              </div>
            </div>
          </div>
          <div className="flex-1">{children}</div>
        </main>
      </div>

      <SupportModal
        open={supportOpen}
        onOpenChange={setSupportOpen}
        userEmail={userEmail}
      />
      <FeedbackModal
        open={feedbackOpen}
        onOpenChange={setFeedbackOpen}
        userEmail={userEmail}
      />
      </SidebarProvider>
    </AlertProvider>
  );
}