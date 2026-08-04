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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { firebaseAuth } from '@/lib/firebase/client';

/**
 * The signed-in control in the header.
 *
 * Signing out has two halves and both matter: clearing the session cookie so
 * this server stops recognising the request, and signing out of Firebase in the
 * browser so the SDK stops refreshing tokens and offering to re-authenticate.
 * Doing only the first leaves a client that believes it is still signed in and
 * will silently mint a new session on the next visit.
 */
export function UserMenu({ email }: { email: string }) {
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
          <UserIcon aria-hidden="true" />
          <span className="hidden max-w-[12ch] truncate sm:inline">
            {email}
          </span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
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
