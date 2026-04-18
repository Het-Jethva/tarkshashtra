import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { api } from '../api';
import { Button, Card, Input, Select, Textarea } from '../components';
import { toast } from 'sonner';
import { SlaRing } from '../complaint-ui';
import type { Complaint } from '../types';

const schema = z.object({
  source: z.enum(['email', 'call', 'direct']),
  content: z.string().min(10, 'Complaint content is required'),
  customerName: z.string().optional(),
  customerContact: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function ExecutiveIntake() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewComplaint, setPreviewComplaint] = useState<Complaint | null>(null);
  const navigate = useNavigate();

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { source: 'call' },
  });

  const onSubmit = async (data: FormValues) => {
    try {
      setIsSubmitting(true);
      const res = await api.createExecutiveComplaint(data);
      setPreviewComplaint(res);
      toast.success('Complaint logged successfully');
      navigate(`/admin/complaints/${res.id}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to log complaint');
    } finally {
      setIsSubmitting(false);
    }
  };

  const previewTimeline = useMemo(
    () => ['Submitted', previewComplaint ? 'Classified' : 'Classifying', previewComplaint ? 'Action Taken' : 'Pending', previewComplaint ? 'Resolved' : 'Pending'],
    [previewComplaint],
  );

  return (
    <div className="space-y-6 max-w-2xl mx-auto py-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Log New Complaint</h1>
      </div>

      <Card className="p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Source *</label>
              <Select {...register('source')}>
                <option value="call">Phone Call</option>
                <option value="email">Email</option>
                <option value="direct">Direct/In-Person</option>
              </Select>
            </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Customer Name (Optional)</label>
              <Input {...register('customerName')} placeholder="John Doe" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Contact (Optional)</label>
              <Input {...register('customerContact')} placeholder="Phone or Email" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Complaint Details *</label>
            <Textarea 
              {...register('content')} 
              rows={6} 
              placeholder="Detailed description of the issue..."
            />
            {errors.content && <p className="mt-1 text-sm text-red-600">{errors.content.message}</p>}
          </div>

          <div className="rounded-lg border border-zinc-200 p-4 bg-zinc-50/60 space-y-2">
            <div className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">AI Result Preview</div>
            {previewComplaint ? (
              <>
                <div className="text-sm text-zinc-700">Category: <span className="font-semibold text-zinc-900">{previewComplaint.category ?? previewComplaint.triageResult?.category ?? 'Untriaged'}</span></div>
                <div className="text-sm text-zinc-700">Priority: <span className="font-semibold text-zinc-900">{previewComplaint.priority ?? previewComplaint.triageResult?.priority ?? 'Untriaged'}</span></div>
                <div className="text-sm text-zinc-700">Sentiment: <span className="font-semibold text-zinc-900">{previewComplaint.sentiment ?? previewComplaint.triageResult?.sentiment ?? 'Unknown'}</span></div>
                <div className="text-sm text-zinc-700">Reason: {previewComplaint.priorityReason ?? previewComplaint.triageResult?.priorityReason ?? 'Not available'}</div>
                <SlaRing complaint={previewComplaint} />
              </>
            ) : (
              <div className="text-sm text-zinc-500">Submit to view classification panel on this screen.</div>
            )}
          </div>

          <div className="rounded-lg border border-zinc-200 p-4 bg-white">
            <div className="text-xs uppercase tracking-wider text-zinc-500 font-semibold mb-2">Timeline</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {previewTimeline.map((step, index) => (
                <div key={`${step}-${index}`} className="text-xs rounded border border-zinc-200 px-2 py-1 text-zinc-700 bg-zinc-50">
                  {step}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end space-x-4">
            <Button type="button" variant="secondary" onClick={() => navigate('/admin/complaints')}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Logging...' : 'Log Complaint'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
