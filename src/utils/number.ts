/** Numeric helpers. */

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Serialises Prisma `BigInt` columns so they survive `JSON.stringify`. */
export function serializeBigInt<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, val) =>
      typeof val === 'bigint' ? Number(val) : val,
    ),
  ) as T;
}
