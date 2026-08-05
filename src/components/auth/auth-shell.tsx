import type { ReactNode } from 'react';

import { Check } from 'lucide-react';

import { PLANS } from '@/lib/plans';
import { formatBytes } from '@/utils';

/**
 * Shared frame for sign-in, sign-up and password reset.
 *
 * The form previously sat bare on the page background while every other surface
 * on the site is a card, which is most of why these pages looked unfinished. It
 * also asked people to register without saying what registering gets them: the
 * only stated reason was conversion history, when an account actually doubles
 * the daily allowance, raises the file ceiling five-fold and unlocks text
 * recognition.
 *
 * The panel beside the form fixes both at once — it fills a column that was
 * empty, and every number in it is read from `PLANS`, so it cannot drift from
 * what the server enforces.
 */

function benefits() {
  const guest = PLANS.ANONYMOUS;
  const member = PLANS.FREE;

  return [
    `${member.jobsPerPeriod} conversions a day, up from ${guest.jobsPerPeriod}`,
    `Files up to ${formatBytes(member.maxFileBytes, 0)}, up from ${formatBytes(guest.maxFileBytes, 0)}`,
    `${member.maxBatchFiles} files at once, up from ${guest.maxBatchFiles}`,
    `Results kept ${member.retentionHours} hours, not ${guest.retentionHours}`,
    'Your conversion history, on any device',
    'Text recognition, to make a scan searchable',
  ];
}

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="container py-12 sm:py-16">
      <div className="mx-auto grid max-w-4xl items-start gap-8 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {subtitle}
            </p>
          </div>

          <div className="mt-6">{children}</div>

          {footer ? (
            <div className="mt-6 border-t pt-5 text-center text-sm text-muted-foreground">
              {footer}
            </div>
          ) : null}
        </div>

        {/* Second in the source order, so a screen reader and a phone both meet
            the form first — the panel is a reason to continue, not a gate. */}
        <aside className="rounded-2xl border bg-muted/30 p-6">
          <h2 className="text-sm font-semibold tracking-tight">
            What an account adds
          </h2>
          <ul className="mt-4 space-y-3">
            {benefits().map((item) => (
              <li key={item} className="flex gap-2.5 text-sm leading-relaxed">
                <Check
                  className="mt-0.5 size-4 shrink-0 text-success"
                  aria-hidden="true"
                />
                <span className="text-muted-foreground">{item}</span>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
            It stays free. Converting has never needed an account and still does
            not.
          </p>
        </aside>
      </div>
    </div>
  );
}
