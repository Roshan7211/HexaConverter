'use client';

import { useState } from 'react';

import { CheckCircle2, Send } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { contactSchema, fieldErrors } from '@/api/schemas';
import { cn } from '@/utils';

/** Contact form with client-side validation mirroring the server schema. */
export function ContactForm() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});

    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get('name') ?? ''),
      email: String(form.get('email') ?? ''),
      subject: String(form.get('subject') ?? ''),
      message: String(form.get('message') ?? ''),
      website: String(form.get('website') ?? ''),
    };

    const parsed = contactSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });

      const body = (await response.json()) as {
        error?: string;
        fields?: Record<string, string>;
      };

      if (!response.ok) {
        if (body.fields) setErrors(body.fields);
        toast.error(body.error ?? 'The message could not be sent.');
        return;
      }

      setSent(true);
      toast.success('Message sent. We usually reply within one business day.');
    } catch {
      toast.error('The message could not be sent. Check your connection.');
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-xl border border-success/40 bg-success/5 p-8 text-center">
        <CheckCircle2
          className="mx-auto size-10 text-success"
          aria-hidden="true"
        />
        <h2 className="mt-4 text-lg font-semibold tracking-tight">
          Message received
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Thanks for getting in touch. We reply to every message, usually within
          one business day.
        </p>
        <Button
          className="mt-6"
          variant="outline"
          onClick={() => setSent(false)}
        >
          Send another message
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="name" label="Your name" error={errors.name}>
          <Input
            id="name"
            name="name"
            autoComplete="name"
            required
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? 'name-error' : undefined}
          />
        </Field>

        <Field id="email" label="Email address" error={errors.email}>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'email-error' : undefined}
          />
        </Field>
      </div>

      <Field id="subject" label="Subject" error={errors.subject}>
        <Input
          id="subject"
          name="subject"
          required
          aria-invalid={Boolean(errors.subject)}
          aria-describedby={errors.subject ? 'subject-error' : undefined}
        />
      </Field>

      <Field id="message" label="Message" error={errors.message}>
        <textarea
          id="message"
          name="message"
          rows={6}
          required
          aria-invalid={Boolean(errors.message)}
          aria-describedby={errors.message ? 'message-error' : undefined}
          className={cn(
            'flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm',
            'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            'aria-[invalid=true]:border-destructive',
          )}
          placeholder="Tell us what you need help with, including the file formats involved."
        />
      </Field>

      {/* Honeypot: hidden from users, irresistible to bots. */}
      <div
        aria-hidden="true"
        className="absolute left-[-9999px] top-auto size-px overflow-hidden"
      >
        <label htmlFor="website">Leave this field empty</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <Button type="submit" loading={submitting} className="w-full sm:w-auto">
        <Send aria-hidden="true" />
        Send message
      </Button>
    </form>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
