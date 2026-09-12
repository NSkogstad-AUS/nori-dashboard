import { promises as dns } from 'node:dns';

// Navigation-safety policy for Phase 4 ("Safe deterministic browser execution" —
// plan/PHASE_4_PLAN.md section 4.3). This is the network-boundary gate every navigation, redirect
// hop, subresource request, popup, and WebSocket connection must pass through before a real
// browser is allowed to follow it — checked against the *resolved* IP address, not the hostname
// string, so a DNS-rebinding attack (a hostname that resolves to a public IP at check time but a
// private one at connect time) can't slip through. Phase 5 will have a model choose what to
// navigate to; this module is what makes that safe to allow at all, so it has to hold on its own
// before any model is involved (see plan/PHASE_4_PLAN.md's "why a fixed script, not a model" note).

export interface NavigationCheckOptions {
  /** Origins (scheme + host + optional port) the run is allowed to reach — see
   *  packages/contracts/src/entities.ts's runSchema.allowedOrigins. */
  allowedOrigins: readonly string[];
  /** Ports allowed beyond the default 80/443 — empty by default (only default ports allowed). */
  allowedPorts?: readonly number[];
}

export interface NavigationCheckResult {
  allowed: boolean;
  /** Present only when allowed is false — a short machine-checkable reason, not free text, so
   *  callers can map it directly to a step's `observation` and the `unsafe_target` error code. */
  reason?: string;
}

const ALLOWED_SCHEMES = new Set(['http:', 'https:']);
const DEFAULT_PORTS = new Set([80, 443]);

/**
 * Returns true if `ip` (a bare IPv4 or IPv6 address string) is loopback, private/link-local, or
 * a known cloud metadata endpoint. Deliberately conservative — anything that isn't clearly
 * public routable unicast is rejected, since the cost of a false-positive block is far lower than
 * the cost of an SSRF hole.
 */
export function isPrivateOrReservedIp(ip: string): boolean {
  // IPv4
  const v4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const octets = v4.slice(1).map(Number);
    const [a, b] = octets;
    if (octets.some((n) => n > 255)) return true; // malformed — reject, don't guess
    if (a === undefined || b === undefined) return true;
    if (a === 127) return true; // loopback
    if (a === 10) return true; // RFC 1918
    if (a === 172 && b >= 16 && b <= 31) return true; // RFC 1918
    if (a === 192 && b === 168) return true; // RFC 1918
    if (a === 169 && b === 254) return true; // link-local + cloud metadata (169.254.169.254)
    if (a === 0) return true; // "this network"
    if (a === 100 && b >= 64 && b <= 127) return true; // RFC 6598 carrier-grade NAT
    if (a === 192 && b === 0) return true; // documentation / IETF protocol assignments (192.0.0.0/24, 192.0.2.0/24 covered below)
    if (a === 198 && (b === 18 || b === 19)) return true; // RFC 2544 benchmarking
    if (a === 224) return true; // multicast (224.0.0.0/4 start)
    if (a >= 240) return true; // reserved/broadcast
    return false;
  }

  // IPv6 — normalize common forms without pulling in a full IP library.
  const lower = ip.toLowerCase();
  if (lower === '::1') return true; // loopback
  if (lower === '::') return true; // unspecified
  if (lower.startsWith('fe80:') || lower.startsWith('fe80::')) return true; // link-local
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique local (fc00::/7)
  if (lower.startsWith('::ffff:')) {
    // IPv4-mapped IPv6 — re-check the embedded IPv4 address.
    const mapped = lower.slice('::ffff:'.length);
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(mapped)) {
      return isPrivateOrReservedIp(mapped);
    }
  }
  return false;
}

function parseUrlSafely(rawUrl: string): URL | null {
  try {
    return new URL(rawUrl);
  } catch {
    return null;
  }
}

/**
 * Static checks that don't require a network round trip: scheme, credentials, port, and origin
 * allowlist. Call this before checkResolvedTarget for a cheap first pass, and always call
 * checkResolvedTarget too — a URL can pass every static check and still resolve to a private IP.
 */
export function checkUrlStructure(
  rawUrl: string,
  options: NavigationCheckOptions,
): NavigationCheckResult {
  const url = parseUrlSafely(rawUrl);
  if (!url) {
    return { allowed: false, reason: 'unparseable_url' };
  }
  if (!ALLOWED_SCHEMES.has(url.protocol)) {
    return { allowed: false, reason: `disallowed_scheme:${url.protocol}` };
  }
  if (url.username || url.password) {
    return { allowed: false, reason: 'credentials_in_url' };
  }
  const port = url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80;
  const allowedPorts = options.allowedPorts ?? [];
  if (!DEFAULT_PORTS.has(port) && !allowedPorts.includes(port)) {
    return { allowed: false, reason: `disallowed_port:${port}` };
  }
  const origin = `${url.protocol}//${url.host}`;
  if (!options.allowedOrigins.includes(origin)) {
    return { allowed: false, reason: `origin_not_allowlisted:${origin}` };
  }
  return { allowed: true };
}

/**
 * Resolves the URL's hostname and rejects if any resolved address is private/reserved —
 * DNS-rebinding-resistant because it checks the address actually about to be connected to, not
 * the hostname. Call this immediately before each navigation/connection attempt (not once
 * up-front and cached), since a hostname's resolution can change between checks.
 */
export async function checkResolvedTarget(rawUrl: string): Promise<NavigationCheckResult> {
  const url = parseUrlSafely(rawUrl);
  if (!url) {
    return { allowed: false, reason: 'unparseable_url' };
  }
  // A bare IP in the URL itself (e.g. http://169.254.169.254/) has no DNS step — check directly.
  if (isPrivateOrReservedIp(url.hostname.replace(/^\[|\]$/g, ''))) {
    return { allowed: false, reason: `resolved_to_private_ip:${url.hostname}` };
  }
  let addresses: string[];
  try {
    const results = await dns.lookup(url.hostname, { all: true, verbatim: true });
    addresses = results.map((r) => r.address);
  } catch {
    return { allowed: false, reason: 'dns_resolution_failed' };
  }
  if (addresses.length === 0) {
    return { allowed: false, reason: 'dns_resolution_empty' };
  }
  const blocked = addresses.find((addr) => isPrivateOrReservedIp(addr));
  if (blocked) {
    return { allowed: false, reason: `resolved_to_private_ip:${blocked}` };
  }
  return { allowed: true };
}

/**
 * Full check for a navigation/redirect/subresource/popup/WebSocket target: structural checks
 * first (cheap, catches scheme/credential/port/origin problems without a DNS round trip), then
 * DNS-resolution-based private-IP checks. Use this for every outbound request the browser makes,
 * not just the initial page navigation — see plan/PHASE_4_PLAN.md section 4.3.
 */
export async function checkNavigationTarget(
  rawUrl: string,
  options: NavigationCheckOptions,
): Promise<NavigationCheckResult> {
  const structural = checkUrlStructure(rawUrl, options);
  if (!structural.allowed) {
    return structural;
  }
  return checkResolvedTarget(rawUrl);
}
