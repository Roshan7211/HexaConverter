import { describe, expect, it } from 'vitest';

import { ownerFilter } from '@/database/repositories/job.repository';

/**
 * Who can see which conversion.
 *
 * This is the filter behind every job lookup, and it has a trap in it: a scope
 * without a `userId` is read as *anonymous*, which pins the query to
 * `userId: null`. Pass a signed-in person's scope with the user id left off and
 * the query does not merely widen — it excludes every job they own.
 *
 * That is exactly what happened. A helper built `{ guestId }` by hand, so a
 * signed-in visitor's conversion completed, wrote its output, and then answered
 * 404 to its own status endpoint forever. The file sat at "Queued" and could
 * never be downloaded.
 */

describe('ownerFilter', () => {
  it('pins an anonymous scope to jobs with no account', () => {
    // Without this a signed-out visitor would see conversions belonging to
    // whoever last used the browser and then signed out.
    expect(ownerFilter({ guestId: 'g1' })).toEqual({
      guestId: 'g1',
      userId: null,
    });
  });

  it('matches an account and its own browser once signed in', () => {
    const filter = ownerFilter({ guestId: 'g1', userId: 'u1' });

    expect(filter).toEqual({
      OR: [{ userId: 'u1' }, { guestId: 'g1', userId: null }],
    });
  });

  it('does not exclude account jobs when a user id is present', () => {
    // The regression, stated directly: the signed-in branch must never carry
    // `userId: null` at the top level, because a job owned by an account has a
    // user id and would be filtered out by its own owner's query.
    const filter = ownerFilter({ guestId: 'g1', userId: 'u1' }) as {
      userId?: unknown;
      OR?: unknown[];
    };

    expect(filter.userId).toBeUndefined();
    expect(filter.OR).toHaveLength(2);
  });

  it('treats a null user id as anonymous, not as a signed-in scope', () => {
    expect(ownerFilter({ guestId: 'g1', userId: null })).toEqual({
      guestId: 'g1',
      userId: null,
    });
  });
});
