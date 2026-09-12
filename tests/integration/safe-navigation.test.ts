// Security tests for the Phase 4 navigation-safety policy (packages/agent/src/safe-navigation.ts)
// — the phase's literal gate: "Security tests demonstrate blocked internal/private targets before
// accepting user-submitted URLs." See plan/PHASE_4_PLAN.md section 4.6.
//
// These are unit-level tests against the policy module directly (no real browser/network needed
// for the blocked cases — DNS lookups for public hostnames do happen for the allowed cases, so
// this suite needs network access to resolve them).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkNavigationTarget,
  checkResolvedTarget,
  checkUrlStructure,
  isPrivateOrReservedIp,
} from '@nori/agent';

const FIXTURE_ORIGIN = 'http://localhost:8082';
// The fixture site runs on a non-standard port (8082) — real allowedOrigins entries in
// production will typically be plain :80/:443 origins, but the policy still needs an explicit
// allowedPorts entry for anything else, exercised here.
const options = { allowedOrigins: [FIXTURE_ORIGIN], allowedPorts: [8082] };

test('isPrivateOrReservedIp — IPv4 ranges', () => {
  assert.equal(isPrivateOrReservedIp('127.0.0.1'), true, 'loopback');
  assert.equal(isPrivateOrReservedIp('10.0.0.1'), true, 'RFC 1918 10/8');
  assert.equal(isPrivateOrReservedIp('172.16.0.1'), true, 'RFC 1918 172.16/12 start');
  assert.equal(isPrivateOrReservedIp('172.31.255.255'), true, 'RFC 1918 172.16/12 end');
  assert.equal(isPrivateOrReservedIp('172.32.0.1'), false, 'just outside 172.16/12');
  assert.equal(isPrivateOrReservedIp('192.168.1.1'), true, 'RFC 1918 192.168/16');
  assert.equal(isPrivateOrReservedIp('169.254.169.254'), true, 'cloud metadata endpoint');
  assert.equal(isPrivateOrReservedIp('169.254.0.1'), true, 'link-local');
  assert.equal(isPrivateOrReservedIp('8.8.8.8'), false, 'public DNS resolver');
  assert.equal(isPrivateOrReservedIp('93.184.216.34'), false, 'public unicast');
});

test('isPrivateOrReservedIp — IPv6 ranges', () => {
  assert.equal(isPrivateOrReservedIp('::1'), true, 'loopback');
  assert.equal(isPrivateOrReservedIp('fe80::1'), true, 'link-local');
  assert.equal(isPrivateOrReservedIp('fc00::1'), true, 'unique local fc00::/7');
  assert.equal(isPrivateOrReservedIp('fd12:3456::1'), true, 'unique local fd00::/8');
  assert.equal(isPrivateOrReservedIp('::ffff:127.0.0.1'), true, 'IPv4-mapped loopback');
  assert.equal(isPrivateOrReservedIp('2001:4860:4860::8888'), false, 'public IPv6 (Google DNS)');
});

test('checkUrlStructure — rejects disallowed schemes', () => {
  const result = checkUrlStructure('file:///etc/passwd', options);
  assert.equal(result.allowed, false);
  assert.match(result.reason ?? '', /disallowed_scheme/);
});

test('checkUrlStructure — rejects javascript: scheme', () => {
  const result = checkUrlStructure('javascript:alert(1)', options);
  assert.equal(result.allowed, false);
});

test('checkUrlStructure — rejects credentials in URL', () => {
  const result = checkUrlStructure('http://user:pass@localhost:8082/', options);
  assert.equal(result.allowed, false);
  assert.match(result.reason ?? '', /credentials_in_url/);
});

test('checkUrlStructure — rejects non-allowlisted origin', () => {
  const result = checkUrlStructure('http://evil.example.com/', options);
  assert.equal(result.allowed, false);
  assert.match(result.reason ?? '', /origin_not_allowlisted/);
});

test('checkUrlStructure — rejects non-standard port not in allowlist', () => {
  const result = checkUrlStructure('http://localhost:9999/', options);
  assert.equal(result.allowed, false);
  assert.match(result.reason ?? '', /disallowed_port/);
});

test('checkUrlStructure — allows the fixture origin on its configured port', () => {
  const result = checkUrlStructure(`${FIXTURE_ORIGIN}/`, options);
  assert.equal(result.allowed, true);
});

test('checkResolvedTarget — rejects a bare private IP with no DNS step', async () => {
  const result = await checkResolvedTarget('http://127.0.0.1:8082/');
  assert.equal(result.allowed, false);
  assert.match(result.reason ?? '', /resolved_to_private_ip/);
});

test('checkResolvedTarget — rejects the cloud metadata endpoint', async () => {
  const result = await checkResolvedTarget('http://169.254.169.254/latest/meta-data/');
  assert.equal(result.allowed, false);
  assert.match(result.reason ?? '', /resolved_to_private_ip/);
});

test('checkResolvedTarget — rejects IPv6 loopback', async () => {
  const result = await checkResolvedTarget('http://[::1]:8082/');
  assert.equal(result.allowed, false);
  assert.match(result.reason ?? '', /resolved_to_private_ip/);
});

test('checkResolvedTarget — rejects localhost (resolves to a loopback address)', async () => {
  // "localhost" is not special-cased as safe — it resolves to a loopback address like any other
  // hostname would, and must be rejected on that basis. Documented explicitly since the fixture
  // site's own origin uses "localhost", which could otherwise look like an oversight rather than
  // a deliberate check.
  const result = await checkResolvedTarget('http://localhost:8082/');
  assert.equal(result.allowed, false, 'localhost resolves to loopback and must be rejected');
});

test('checkNavigationTarget — full check rejects a redirect-style target pointed at a private IP', async () => {
  const result = await checkNavigationTarget('http://10.0.0.5/internal-api', {
    allowedOrigins: ['http://10.0.0.5'],
  });
  assert.equal(result.allowed, false, 'even an allowlisted origin must fail resolved-IP checks');
});

test('checkNavigationTarget — allows a real public origin when allowlisted', async () => {
  const result = await checkNavigationTarget('https://example.com/', {
    allowedOrigins: ['https://example.com'],
  });
  assert.equal(result.allowed, true);
});

test('checkNavigationTarget — structural rejection short-circuits before DNS', async () => {
  const result = await checkNavigationTarget('http://evil.example.com/', options);
  assert.equal(result.allowed, false);
  assert.match(result.reason ?? '', /origin_not_allowlisted/);
});
