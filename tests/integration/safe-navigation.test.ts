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
  checkRedirectChain,
  checkResolvedTarget,
  checkUrlStructure,
  checkWebSocketTarget,
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

test('checkNavigationTarget — allows a public resolved address when allowlisted', async () => {
  const result = await checkNavigationTarget('https://example.com/', {
    allowedOrigins: ['https://example.com'],
    resolveHostname: async () => ['93.184.216.34'],
  });
  assert.equal(result.allowed, true);
});

test('redirect chain revalidates every hop and rejects a private final target', async () => {
  const result = await checkRedirectChain(
    ['https://example.com/start', 'http://10.0.0.5/internal'],
    {
      allowedOrigins: ['https://example.com', 'http://10.0.0.5'],
      resolveHostname: async () => ['93.184.216.34'],
    },
  );
  assert.equal(result.allowed, false);
  assert.match(result.reason ?? '', /resolved_to_private_ip/);
});

test('DNS answers are re-resolved and a rebinding change is rejected', async () => {
  let lookup = 0;
  const rebindingOptions = {
    allowedOrigins: ['https://example.com'],
    resolveHostname: async () => (++lookup === 1 ? ['93.184.216.34'] : ['127.0.0.1']),
  };
  assert.equal(
    (await checkNavigationTarget('https://example.com/', rebindingOptions)).allowed,
    true,
  );
  const rebound = await checkNavigationTarget('https://example.com/', rebindingOptions);
  assert.equal(rebound.allowed, false);
  assert.match(rebound.reason ?? '', /resolved_to_private_ip/);
});

test('WebSocket targets use the equivalent allowlisted HTTP origin', async () => {
  const result = await checkWebSocketTarget('wss://example.com/socket', {
    allowedOrigins: ['https://example.com'],
    resolveHostname: async () => ['93.184.216.34'],
  });
  assert.equal(result.allowed, true);
});

test('WebSocket targets cannot bypass private-address checks', async () => {
  const result = await checkWebSocketTarget('ws://127.0.0.1/socket', {
    allowedOrigins: ['http://127.0.0.1'],
  });
  assert.equal(result.allowed, false);
});

test('checkNavigationTarget — structural rejection short-circuits before DNS', async () => {
  const result = await checkNavigationTarget('http://evil.example.com/', options);
  assert.equal(result.allowed, false);
  assert.match(result.reason ?? '', /origin_not_allowlisted/);
});

test('allowPrivateTargets — defaults to strict (false) when omitted', async () => {
  const result = await checkNavigationTarget('http://127.0.0.1:8082/', {
    allowedOrigins: ['http://127.0.0.1:8082'],
    allowedPorts: [8082],
  });
  assert.equal(result.allowed, false, 'omitting allowPrivateTargets must not implicitly allow it');
});

test('allowPrivateTargets — explicit true allows a private target that would otherwise be blocked', async () => {
  const result = await checkNavigationTarget('http://127.0.0.1:8082/', {
    allowedOrigins: ['http://127.0.0.1:8082'],
    allowedPorts: [8082],
    allowPrivateTargets: true,
  });
  assert.equal(result.allowed, true);
});

test('allowPrivateTargets — still enforces structural checks (origin allowlist) even when true', async () => {
  const result = await checkNavigationTarget('http://127.0.0.1:9999/', {
    allowedOrigins: ['http://127.0.0.1:8082'],
    allowPrivateTargets: true,
  });
  assert.equal(result.allowed, false, 'allowPrivateTargets must not bypass the origin allowlist');
});

// allowSubdomains — opt-in widening so a run against a real site can load the assets that site
// serves from its own sibling hosts (cdn./static./assets.). The risk this has to not introduce
// is a lookalike domain passing as a subdomain, so the matching is asserted here in both
// directions: the sibling host is reachable, and every near-miss spelling is not.

const SUB_ALLOWED = { allowedOrigins: ['https://example.com'], allowSubdomains: true };

test('allowSubdomains — off by default: a subdomain is not implicitly allowlisted', () => {
  const result = checkUrlStructure('https://cdn.example.com/app.js', {
    allowedOrigins: ['https://example.com'],
  });
  assert.equal(result.allowed, false, 'omitting allowSubdomains must keep exact-origin matching');
  assert.equal(result.reason, 'origin_not_allowlisted:https://cdn.example.com');
});

test('allowSubdomains — allows the exact origin and its subdomains', () => {
  assert.equal(checkUrlStructure('https://example.com/', SUB_ALLOWED).allowed, true, 'exact');
  assert.equal(
    checkUrlStructure('https://cdn.example.com/app.js', SUB_ALLOWED).allowed,
    true,
    'single-label subdomain',
  );
  assert.equal(
    checkUrlStructure('https://deep.cdn.example.com/app.js', SUB_ALLOWED).allowed,
    true,
    'nested subdomain',
  );
});

test('allowSubdomains — rejects lookalike domains that merely share a suffix', () => {
  for (const url of [
    'https://notexample.com/',
    'https://evil-example.com/',
    'https://example.com.evil.com/',
    'https://fooexample.com/',
  ]) {
    const result = checkUrlStructure(url, SUB_ALLOWED);
    assert.equal(result.allowed, false, `must reject ${url} — matching is on a dot boundary`);
  }
});

test('allowSubdomains — does not relax scheme or port for a subdomain', () => {
  assert.equal(
    checkUrlStructure('http://cdn.example.com/', SUB_ALLOWED).allowed,
    false,
    'https allowlist entry must not permit an http subdomain',
  );
  assert.equal(
    checkUrlStructure('https://cdn.example.com:8443/', SUB_ALLOWED).allowed,
    false,
    'a subdomain on a non-default port must still fail the port check',
  );
});

test('allowSubdomains — does not climb upward from a narrower allowlisted host', () => {
  const result = checkUrlStructure('https://example.com/', {
    allowedOrigins: ['https://cdn.example.com'],
    allowSubdomains: true,
  });
  assert.equal(result.allowed, false, 'being authorized for cdn. must not authorize the parent');
});

test('allowSubdomains — an allowlisted bare IP gains no subdomains', () => {
  const result = checkUrlStructure('https://sub.93.184.216.34/', {
    allowedOrigins: ['https://93.184.216.34'],
    allowSubdomains: true,
  });
  assert.equal(result.allowed, false, 'an IP has no subdomains');
});

test('allowSubdomains — still rejects a subdomain that resolves to a private IP', async () => {
  for (const address of ['127.0.0.1', '169.254.169.254', '10.0.0.5']) {
    const result = await checkNavigationTarget('https://cdn.example.com/', {
      ...SUB_ALLOWED,
      resolveHostname: async () => [address],
    });
    assert.equal(result.allowed, false, `subdomain resolving to ${address} must stay blocked`);
    assert.equal(result.reason, `resolved_to_private_ip:${address}`);
  }
});

test('allowSubdomains — unrelated third-party hosts remain blocked', () => {
  const result = checkUrlStructure('https://tracker.example.net/pixel.gif', SUB_ALLOWED);
  assert.equal(result.allowed, false, 'widening to subdomains must not admit other registrables');
});
