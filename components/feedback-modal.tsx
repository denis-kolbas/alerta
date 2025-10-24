'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface FeedbackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userEmail: string;
}

export function FeedbackModal({ open, onOpenChange, userEmail }: FeedbackModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [problem, setProblem] = useState('');
  const [satisfaction, setSatisfaction] = useState<number | null>(null);
  const [improvement, setImprovement] = useState('');
  const [nps, setNps] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!problem.trim() || satisfaction === null || !improvement.trim() || nps === null) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          problem,
          satisfaction,
          improvement,
          nps,
        }),
      });

      if (response.ok) {
        toast.success('Thank you for your feedback!');
        setProblem('');
        setSatisfaction(null);
        setImprovement('');
        setNps(null);
        onOpenChange(false);
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to submit feedback');
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast.error('Failed to submit feedback');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Share Your Feedback</DialogTitle>
          <DialogDescription>
            Help us improve by sharing your experience with Alerta.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          <div className="space-y-2">
            <Label htmlFor="problem">What problem were you trying to solve?</Label>
            <Textarea
              id="problem"
              placeholder="Describe the problem or use case..."
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              disabled={isSubmitting}
              required
              rows={3}
              className="bg-white border-gray-300"
            />
          </div>

          <div className="space-y-3">
            <Label>How well did Alerta solve that problem?</Label>
            <div className="grid grid-cols-11 gap-1">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSatisfaction(value)}
                  disabled={isSubmitting}
                  className={`aspect-square flex items-center justify-center rounded border-2 transition-all text-sm ${
                    satisfaction === value
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Not at all</span>
              <span>Extremely well</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="improvement">What&apos;s the ONE thing we should improve first?</Label>
            <Textarea
              id="improvement"
              placeholder="Your top priority for improvement..."
              value={improvement}
              onChange={(e) => setImprovement(e.target.value)}
              disabled={isSubmitting}
              required
              rows={3}
              className="bg-white border-gray-300"
            />
          </div>

          <div className="space-y-3">
            <Label>How likely are you to recommend this to a colleague?</Label>
            <div className="grid grid-cols-11 gap-1">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setNps(value)}
                  disabled={isSubmitting}
                  className={`aspect-square flex items-center justify-center rounded border-2 transition-all text-sm ${
                    nps === value
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Not likely</span>
              <span>Very likely</span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Feedback
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
