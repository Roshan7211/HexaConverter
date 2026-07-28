import type { Metadata } from 'next';
import Link from 'next/link';

import { BookOpen, LifeBuoy, ShieldQuestion } from 'lucide-react';

import { ContactForm } from '@/components/marketing/contact-form';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  title: 'Contact',
  description:
    'Questions about a conversion, bulk usage or a security concern? Send a message and a person will answer.',
  path: '/contact',
});

const ROUTES = [
  {
    icon: LifeBuoy,
    title: 'Support',
    body: 'A conversion failed or produced an unexpected result? Include the file formats and the error message.',
  },
  {
    icon: BookOpen,
    title: 'Bulk and self-hosting',
    body: 'Tell us your monthly volume, retention needs and any data-residency requirements.',
  },
  {
    icon: ShieldQuestion,
    title: 'Security',
    body: 'Report a vulnerability responsibly and we will acknowledge it within two business days.',
  },
] as const;

export default function ContactPage() {
  return (
    <>
      <section className="surface-gradient border-b">
        <div className="container py-16 text-center sm:py-20">
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            Get in touch
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-lg text-muted-foreground">
            Check the{' '}
            <Link
              href="/faq"
              className="text-primary underline-offset-4 hover:underline"
            >
              FAQ
            </Link>{' '}
            first — it covers most questions. Anything else, use the form below.
          </p>
        </div>
      </section>

      <section className="container grid gap-12 py-14 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div>
          <h2 className="sr-only">Contact form</h2>
          <ContactForm />
        </div>

        <aside className="space-y-5" aria-label="What to contact us about">
          {ROUTES.map((route) => (
            <div key={route.title} className="rounded-xl border bg-card p-5">
              <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-primary">
                <route.icon className="size-4" aria-hidden="true" />
              </span>
              <h3 className="mt-3 text-sm font-semibold tracking-tight">
                {route.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {route.body}
              </p>
            </div>
          ))}
        </aside>
      </section>
    </>
  );
}
