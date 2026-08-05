import { describe, expect, it } from 'vitest';

import { isBlockedAddress } from '@/lib/security/remote-fetch';

/**
 * The address filter behind link import.
 *
 * This is the whole of the SSRF defence, so it is worth testing as its own
 * thing rather than through the endpoint: if it lets one of these through, the
 * server becomes a proxy into the private network for anyone who can paste a
 * URL. Cloud metadata at 169.254.169.254 is the one that turns a curiosity into
 * a credential leak.
 */

describe('isBlockedAddress', () => {
  it('blocks loopback', () => {
    for (const address of ['127.0.0.1', '127.1.2.3', '::1']) {
      expect(isBlockedAddress(address), address).toBe(true);
    }
  });

  it('blocks the cloud metadata address', () => {
    expect(isBlockedAddress('169.254.169.254')).toBe(true);
  });

  it('blocks the private ranges', () => {
    const private_ = [
      '10.0.0.1',
      '10.255.255.255',
      '172.16.0.1',
      '172.31.255.255',
      '192.168.1.1',
      '100.64.0.1', // carrier-grade NAT
      '0.0.0.0',
    ];

    for (const address of private_) {
      expect(isBlockedAddress(address), address).toBe(true);
    }
  });

  it('allows public addresses either side of a private range', () => {
    // 172.15 and 172.32 sit just outside 172.16–172.31 and must not be caught
    // by a filter that tests the first octet alone.
    const publicAddresses = [
      '8.8.8.8',
      '1.1.1.1',
      '172.15.0.1',
      '172.32.0.1',
      '192.167.1.1',
      '192.169.1.1',
      '11.0.0.1',
      '99.64.0.1',
      '101.64.0.1',
    ];

    for (const address of publicAddresses) {
      expect(isBlockedAddress(address), address).toBe(false);
    }
  });

  it('blocks IPv6 private and link-local ranges', () => {
    for (const address of ['fe80::1', 'fc00::1', 'fd12:3456::1', 'ff02::1']) {
      expect(isBlockedAddress(address), address).toBe(true);
    }
  });

  it('sees through IPv4 mapped into IPv6', () => {
    // The form that slips past a filter checking only dotted-quad strings.
    expect(isBlockedAddress('::ffff:127.0.0.1')).toBe(true);
    expect(isBlockedAddress('::ffff:169.254.169.254')).toBe(true);
    expect(isBlockedAddress('::ffff:8.8.8.8')).toBe(false);
  });

  it('blocks multicast and reserved space', () => {
    for (const address of ['224.0.0.1', '239.255.255.250', '255.255.255.255']) {
      expect(isBlockedAddress(address), address).toBe(true);
    }
  });

  it('refuses anything that is not an address at all', () => {
    for (const value of ['', 'not-an-ip', 'localhost', '999.1.1.1']) {
      expect(isBlockedAddress(value), value).toBe(true);
    }
  });
});
