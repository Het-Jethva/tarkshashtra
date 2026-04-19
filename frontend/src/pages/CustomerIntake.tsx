import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import { api } from '../api';
import { Button, Card, Input, Textarea } from '../components';
import { getErrorMessage } from '../lib/errors';
import { isMeaningfulComplaintText, isValidPersonName } from '../lib/form-validation';

const schema = z.object({
  customerName: z
    .string()
    .trim()
    .min(2, 'Name is required')
    .max(120, 'Name is too long')
    .refine((value) => isValidPersonName(value), 'Name should contain letters only'),
  customerContact: z
    .string()
    .trim()
    .email('Please enter a valid email address')
    .max(150, 'Email is too long'),
  content: z
    .string()
    .trim()
    .min(15, 'Please provide more details about your complaint')
    .max(10000, 'Complaint is too long')
    .refine((value) => isMeaningfulComplaintText(value), 'Please enter a meaningful complaint'),
});

type FormValues = z.infer<typeof schema>;

export function CustomerIntake() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successId, setSuccessId] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormValues) => {
    try {
      setIsSubmitting(true);
      const res = await api.submitCustomerDirect(data);
      setSuccessId(res.id);
      toast.success('Information submitted successfully');
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Failed to submit information'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (successId) {
    return (
      <div className="min-h-screen bg-[#fcfcfc] flex items-center justify-center p-6">
        <Card className="w-full max-w-md p-10 text-center shadow-lg border-zinc-200/80">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 mb-6">
            <svg className="h-7 w-7 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">Submission Received</h2>
            <p className="mt-2 text-zinc-500 text-sm">Our team will review your report shortly.</p>
          </div>
          <div className="bg-zinc-50 border border-zinc-200/60 rounded-lg p-4 mt-6 text-sm text-zinc-700">
            <div className="text-xs font-medium text-zinc-500 mb-1 uppercase tracking-wide">Reference ID</div>
            <span className="font-mono text-zinc-900 tracking-tight">{successId}</span>
          </div>
          <Button onClick={() => setSuccessId(null)} variant="secondary" className="w-full mt-8">
            Submit Another Report
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fcfcfc] py-20 px-6 sm:px-8 lg:px-10 flex flex-col items-center">
      <div className="w-full max-w-[500px] space-y-10">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900">Contact Support</h2>
          <p className="text-zinc-500 text-sm">Please provide your details below.</p>
        </div>

        <Card className="p-8 sm:p-10 shadow-lg border-zinc-200/80">
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
            <div className="space-y-5">
              <div>
                <label htmlFor="customer-name" className="block text-sm font-medium text-zinc-900 mb-2">
                  Full Name
                </label>
                <Input
                  id="customer-name"
                  autoComplete="name"
                  aria-invalid={Boolean(errors.customerName)}
                  aria-describedby={errors.customerName ? 'customer-name-error' : undefined}
                  {...register('customerName')}
                  placeholder="Jane Doe"
                />
                {errors.customerName && <p id="customer-name-error" className="mt-1.5 text-xs text-red-500">{errors.customerName.message}</p>}
              </div>

              <div>
                <label htmlFor="customer-contact" className="block text-sm font-medium text-zinc-900 mb-2">
                  Email Address
                </label>
                <Input
                  id="customer-contact"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  spellCheck={false}
                  aria-invalid={Boolean(errors.customerContact)}
                  aria-describedby={errors.customerContact ? 'customer-contact-error' : undefined}
                  {...register('customerContact')}
                  placeholder="jane@example.com"
                />
                {errors.customerContact && <p id="customer-contact-error" className="mt-1.5 text-xs text-red-500">{errors.customerContact.message}</p>}
              </div>

              <div>
                <label htmlFor="complaint-content" className="block text-sm font-medium text-zinc-900 mb-2">
                  Issue Description
                </label>
                <Textarea 
                  id="complaint-content"
                  autoComplete="off"
                  aria-invalid={Boolean(errors.content)}
                  aria-describedby={errors.content ? 'complaint-content-error' : undefined}
                  {...register('content')} 
                  rows={5} 
                  placeholder="How can we help?"
                />
                {errors.content && <p id="complaint-content-error" className="mt-1.5 text-xs text-red-500">{errors.content.message}</p>}
              </div>
            </div>

            <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting} className="w-full h-11 mt-8">
              {isSubmitting ? (
                <div className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Submitting…
                </div>
              ) : 'Submit Report'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
