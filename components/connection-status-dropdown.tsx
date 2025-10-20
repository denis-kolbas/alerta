'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

interface ConnectionStatusDropdownProps {
  integrationName: string;
  onDisconnect: () => Promise<{ success: boolean; error?: string }>;
}

export function ConnectionStatusDropdown({ 
  integrationName, 
  onDisconnect 
}: ConnectionStatusDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const router = useRouter();

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      const result = await onDisconnect();
      
      if (result.success) {
        toast.success(`${integrationName} disconnected successfully`);
        router.push('/dashboard/integrations');
      } else {
        toast.error(result.error || 'Failed to disconnect integration');
      }
    } catch (error) {
      toast.error('An unexpected error occurred');
      console.error('Disconnect error:', error);
    } finally {
      setIsDisconnecting(false);
      setShowConfirmDialog(false);
    }
  };

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 bg-green-600 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-green-700 transition-colors focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2">
            Connected
            <ChevronDown className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem
            className="text-destructive focus:text-destructive cursor-pointer"
            onClick={() => {
              setIsOpen(false);
              setShowConfirmDialog(true);
            }}
          >
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect {integrationName}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will stop syncing data from {integrationName}. You can reconnect at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDisconnecting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisconnect}
              disabled={isDisconnecting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDisconnecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Disconnecting...
                </>
              ) : (
                'Disconnect'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
