'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { LogOut, Settings, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { firebaseAuth } from '@/lib/firebase/client';
import { cn } from '@/utils';

/**
 * The signed-in control in the header.
 *
 * Signing out has two halves and both matter: clearing the session cookie so
 * this server stops recognising the request, and signing out of Firebase in the
 * browser so the SDK stops refreshing tokens and offering to re-authenticate.
 * Doing only the first leaves a client that believes it is still signed in and
 * will silently mint a new session on the next visit.
 */
export interface AccountMenuProps {
  email: string;
  displayName: string | null;
  photoUrl: string | null;
  used: number;
  limit: number;
  remaining: number;
  periodDays: number;
}

export function UserMenu({
  email,
  displayName,
  photoUrl,
  used,
  limit,
  remaining,
  periodDays,
}: AccountMenuProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    if (busy) return;
    setBusy(true);

    try {
      await fetch('/api/auth/session', { method: 'DELETE' });
      // Best-effort: the cookie is what actually authenticates, so a failure
      // here must not stop the user being signed out of this site.
      await firebaseAuth()?.signOut();
      router.push('/');
      router.refresh();
    } catch {
      toast.error('Could not sign out. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2"
          aria-label={`Account: ${email}`}
        >
          {/* Google hands us a picture and a name; showing a generic icon and
              a truncated address instead made a signed-in account look like a
              system state rather than a person. */}
          {photoUrl ? (
            // A 24px avatar from an arbitrary provider host: routing it through
            // the image optimiser would mean allowing that host in the config
            // and paying an optimisation round trip to save nothing.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt=""
              width={24}
              height={24}
              className="size-6 shrink-0 rounded-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <UserIcon aria-hidden="true" />
          )}
          <span className="hidden max-w-[12ch] truncate sm:inline">
            {displayName || email}
          </span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        {/* Who, on what plan, and how much of the allowance is left. The last
            was the real gap: the ceiling is enforced server-side and was
            visible nowhere, so people met it without warning. */}
        <div className="px-2 py-1.5">
          <p className="truncate text-sm font-medium">{displayName || email}</p>
          {displayName ? (
            <p className="truncate text-xs text-muted-foreground">{email}</p>
          ) : null}
        </div>

        <div className="px-2 pb-2 pt-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {periodDays === 1 ? 'Today' : `Last ${periodDays} days`}
            </span>
            <span className="font-medium tabular-nums">
              {used} of {limit}
            </span>
          </div>
          <div
            className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={used}
            aria-valuemin={0}
            aria-valuemax={limit}
            aria-label="Conversions used"
          >
            <div
              className={cn(
                'h-full rounded-full transition-all',
                remaining === 0 ? 'bg-destructive' : 'bg-primary',
              )}
              style={{
                width: `${limit > 0 ? Math.min(100, (used / limit) * 100) : 0}%`,
              }}
            />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {remaining > 0
              ? `${remaining} left, and the window rolls`
              : 'None left — the window rolls as older conversions age out'}
          </p>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href="/account">
            <Settings aria-hidden="true" />
            Your account
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void signOut()} disabled={busy}>
          <LogOut aria-hidden="true" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
