import Link from 'next/link';

import type { PlanTier } from '@prisma/client';
import { Mail, Settings, ShieldCheck } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PLAN_LABEL } from '@/lib/plans';
import { formatDate } from '@/utils';

/** Profile summary. Editing lives in Settings; this is the identity at a glance. */
export function ProfilePanel({
  name,
  email,
  image,
  plan,
  memberSince,
  hasPassword,
}: {
  name: string | null;
  email: string;
  image: string | null;
  plan: PlanTier;
  memberSince: Date;
  hasPassword: boolean;
}) {
  const initials = (name?.trim() || email.split('@')[0] || 'U')
    .split(/[\s._-]+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
        <Avatar className="size-16">
          {image ? <AvatarImage src={image} alt="" /> : null}
          <AvatarFallback className="text-lg">{initials}</AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-lg font-semibold">
              {name ?? 'Your account'}
            </h2>
            <Badge variant={plan === 'FREE' ? 'outline' : 'default'}>
              {PLAN_LABEL[plan]}
            </Badge>
          </div>

          <p className="mt-1 flex items-center gap-1.5 truncate text-sm text-muted-foreground">
            <Mail className="size-3.5 shrink-0" aria-hidden="true" />
            {email}
          </p>

          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5 shrink-0" aria-hidden="true" />
            {hasPassword ? 'Password sign-in' : 'Connected provider'} · member
            since {formatDate(memberSince, { year: 'numeric', month: 'long' })}
          </p>
        </div>

        <Button variant="outline" size="sm" asChild className="shrink-0">
          <Link href="/dashboard/profile">
            <Settings aria-hidden="true" />
            Edit profile
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
