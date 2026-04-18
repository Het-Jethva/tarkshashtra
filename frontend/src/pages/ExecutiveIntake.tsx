import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { format } from 'date-fns';

import { api } from '../api';
import { Badge, Button, Card, Input, Select, Textarea } from '../components';
import { ConfidenceBar, PriorityBadge, SentimentBadge, SlaProgress, SlaRing } from '../complaint-ui';
import { getErrorMessage } from '../lib/errors';
import type { Complaint } from '../types';

const schema = z.object({
  source: z.enum(['email', 'call', 'direct']),
  content: z.string().min(10, 'Complaint content is required'),
  customerName: z.string().min(2, 'Customer name is required'),
  customerContact: z.string().min(3, 'Customer contact is required'),
});

type FormValues = z.infer<typeof schema>;

export function ExecutiveIntake() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resultComplaint, setResultComplaint] = useState<Complaint | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { source: 'call' },
  });

  const onSubmit = async (data: FormValues) => {
    try {
      setIsSubmitting(true);
      const complaint = await api.createExecutiveComplaint(data);
      setResultComplaint(complaint);
      toast.success('Complaint submitted and classified');
      reset({ ...data, content: '' });
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Failed to submit complaint'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const timelineRows = useMemo(() => {
    if (!resultComplaint) {
      return [];
    }

    const createdAt = new Date(resultComplaint.createdAt);
    return [
      { label: 'Submitted', at: createdAt },
      { label: 'Classified', at: new Date(createdAt.getTime() + 30 * 1000) },
      { label: 'Action Taken', at: new Date(createdAt.getTime() + 15 * 60 * 1000) },
      { label: 'Resolved', at: resultComplaint.resolvedAt ? new Date(resultComplaint.resolvedAt) : null },
    ];
  }, [resultComplaint]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Submit + Result</h1>
        <p className="text-sm text-zinc-500 mt-1">Submit a complaint and review AI classification on the same screen.</p>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
          <div>
            <label htmlFor="executive-content" className="block text-sm font-medium text-zinc-700 mb-1">Complaint Text</label>
            <Textarea
              id="executive-content"
              autoComplete="off"
              aria-invalid={Boolean(errors.content)}
              aria-describedby={errors.content ? 'executive-content-error' : undefined}
              {...register('content')}
              rows={6}
              placeholder="Enter customer complaint details"
            />
            {errors.content ? <p id="executive-content-error" className="mt-1 text-xs text-red-600">{errors.content.message}</p> : null}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="executive-source" className="block text-sm font-medium text-zinc-700 mb-1">Source</label>
              <Select id="executive-source" {...register('source')}>
                <option value="call">Call</option>
                <option value="email">Email</option>
                <option value="direct">Direct</option>
              </Select>
            </div>
            <div>
              <label htmlFor="executive-customer-name" className="block text-sm font-medium text-zinc-700 mb-1">Customer Name</label>
              <Input
                id="executive-customer-name"
                autoComplete="name"
                aria-invalid={Boolean(errors.customerName)}
                aria-describedby={errors.customerName ? 'executive-customer-name-error' : undefined}
                {...register('customerName')}
                placeholder="Customer name"
              />
              {errors.customerName ? <p id="executive-customer-name-error" className="mt-1 text-xs text-red-600">{errors.customerName.message}</p> : null}
            </div>
            <div>
              <label htmlFor="executive-customer-contact" className="block text-sm font-medium text-zinc-700 mb-1">Customer Contact</label>
              <Input
                id="executive-customer-contact"
                autoComplete="off"
                spellCheck={false}
                aria-invalid={Boolean(errors.customerContact)}
                aria-describedby={errors.customerContact ? 'executive-customer-contact-error' : undefined}
                {...register('customerContact')}
                placeholder="Phone or email"
              />
              {errors.customerContact ? <p id="executive-customer-contact-error" className="mt-1 text-xs text-red-600">{errors.customerContact.message}</p> : null}
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
              {isSubmitting ? 'Submitting…' : 'Submit Complaint'}
            </Button>
          </div>
        </form>
      </Card>

      {resultComplaint ? (
        <Card className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900">AI Result</h2>
            <Badge variant="default">{resultComplaint.id.slice(0, 10)}</Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-zinc-200 p-4">
              <div className="text-xs text-zinc-500 mb-2">Category</div>
              <div className="font-semibold text-zinc-900 mb-2">{resultComplaint.category ?? 'Untriaged'}</div>
              <ConfidenceBar confidence={resultComplaint.confidence} />
            </div>
            <div className="rounded-lg border border-zinc-200 p-4 space-y-2">
              <div>
                <div className="text-xs text-zinc-500 mb-1">Sentiment</div>
                <SentimentBadge sentiment={resultComplaint.sentiment} score={resultComplaint.sentimentScore} />
              </div>
              <div>
                <div className="text-xs text-zinc-500 mb-1">Priority</div>
                <PriorityBadge priority={resultComplaint.priority} />
              </div>
              <div className="text-xs text-zinc-600">
                {resultComplaint.priorityReason ?? 'Marked priority from sentiment and keyword risk profile'}
              </div>
            </div>
          </div>

          {resultComplaint.duplicateOfComplaintId ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Similar complaint detected and linked to ID {resultComplaint.duplicateOfComplaintId}.
            </div>
          ) : null}

          <div className="rounded-lg border border-zinc-200 p-4">
            <div className="text-xs text-zinc-500 mb-2">Resolution Recommendations</div>
            <ul className="list-disc pl-5 space-y-2 text-sm text-zinc-800">
              {resultComplaint.actions.length > 0
                ? resultComplaint.actions.slice(0, 3).map((action) => <li key={action.id}>{action.action}</li>)
                : [
                    'Acknowledge complaint and share immediate next step with customer.',
                    'Coordinate with warehouse/vendor to validate issue root cause.',
                    'Issue resolution update and close with confirmation from customer.',
                  ].map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-zinc-200 p-4">
              <div className="text-xs text-zinc-500 mb-2">SLA Traffic Ring</div>
              <SlaRing complaint={resultComplaint} />
            </div>
            <div className="rounded-lg border border-zinc-200 p-4">
              <div className="text-xs text-zinc-500 mb-2">SLA Progress</div>
              <SlaProgress complaint={resultComplaint} />
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 p-4">
            <div className="text-xs text-zinc-500 mb-2">Timeline</div>
            <div className="space-y-2">
              {timelineRows.map((item) => (
                <div key={item.label} className="flex items-center justify-between text-sm">
                  <span className="text-zinc-700">{item.label}</span>
                  <span className="text-zinc-500">{item.at ? format(item.at, 'PPp') : 'Pending'}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
