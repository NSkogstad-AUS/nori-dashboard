import { promises as dns } from 'node:dns';
import { isIP } from 'node:net';

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
  /**
   * Also accept subdomains of each allowlisted origin, so a run against https://example.com may
   * load https://cdn.example.com. Real sites serve assets from sibling hosts (cdn./static./
   * assets.), and blocking those leaves the page unable to render — see the origin-matching note
   * on isOriginAllowed for exactly how far this widens the boundary, and what it deliberately
   * does not widen (scheme, port, private-IP and DNS-rebinding checks all still apply
   * unchanged).
   */
  allowSubdomains?: boolean;
  /**
   * Skips the private/reserved-IP rejection in checkResolvedTarget/checkNavigationTarget.
   * Defaults to false — every real navigation (including anything Phase 5's model-driven
   * personas will ever request) must leave this unset. The one legitimate use is Phase 4's own
   * fixture job: a developer's LAN address (e.g. 192.168.x.x) is itself a private RFC 1918
   * address, so there is no address on a typical dev machine that both reaches the local fixture
   * site and passes the strict check — this flag exists so that one caller
   * (apps/worker/src/run-fixture-job.ts) can explicitly opt out for that one known-safe local
   * origin, without weakening the default behavior anyone else gets. Structural checks (scheme,
   * credentials, port, origin allowlist) still apply even when this is true.
   */
  allowPrivateTargets?: boolean;
  /** Injectable only so security tests can prove changing/rebinding DNS answers are rechecked. */
  resolveHostname?: (hostname: string) => Promise<readonly string[]>;
}

export interface NavigationCheckResult {
  allowed: boolean;
  /** Present only when allowed is false — a short machine-checkable reason, not free text, so
   *  callers can map it directly to a step's `observation` and the `unsafe_target` error code. */
  reason?: string;
}

export const defaultResolveHostname = async (hostname: string): Promise<readonly string[]> => {
  const results = await dns.lookup(hostname, { all: true, verbatim: true });
  return results.map((result) => result.address);
};

const ALLOWED_SCHEMES = new Set(['http:', 'https:']);
const DEFAULT_PORTS = new Set([80, 443]);

/**
 * Origin-allowlist match for a candidate URL.
 *
 * Exact origin equality (scheme + host + port) is always the baseline. With `allowSubdomains`,
 * a candidate also matches when its hostname is a *strict subdomain* of an allowlisted origin's
 * hostname and the scheme and port match that entry exactly — so a run against
 * https://example.com additionally accepts https://cdn.example.com.
 *
 * The match is deliberately narrow in ways that matter for SSRF:
 *
 *  * Suffix comparison is on a dot boundary (`.example.com`), never a bare string suffix — so
 *    `notexample.com` and `evil-example.com` do NOT match `example.com`.
 *  * Scheme and port must still match the allowlist entry, so widening to subdomains can't
 *    downgrade https→http or reach a non-default port.
 *  * An allowlisted bare IP never gains subdomains (an IP has no subdomains; treating it as a
 *    suffix would let `1.2.3.4.attacker.com` match `2.3.4`-style entries).
 *  * This only widens *which public hostnames* are reachable. Every candidate still passes the
 *    private/reserved-IP and DNS-rebinding checks in checkResolvedTarget, so a subdomain that
 *    resolves to 127.0.0.1 or 169.254.169.254 is still rejected.
 *
 * It does NOT climb upward: an allowlisted `https://cdn.example.com` does not permit
 * `https://example.com`, since the run was authorized for the narrower host.
 */
export function isOriginAllowed(url: URL, options: NavigationCheckOptions): boolean {
  const origin = `${url.protocol}//${url.host}`;
  if (options.allowedOrigins.includes(origin)) return true;
  if (!options.allowSubdomains) return false;

  const candidateHost = url.hostname.replace(/^\[|\]$/g, '');
  // A bare-IP candidate can only ever match exactly, handled above.
  if (isIP(candidateHost)) return false;

  return options.allowedOrigins.some((allowed) => {
    const allowedUrl = parseUrlSafely(allowed);
    if (!allowedUrl) return false;
    if (allowedUrl.protocol !== url.protocol) return false;
    if (allowedUrl.port !== url.port) return false;
    const allowedHost = allowedUrl.hostname.replace(/^\[|\]$/g, '');
    // An allowlisted IP has no subdomains.
    if (isIP(allowedHost)) return false;
    // Strict subdomain on a dot boundary — never a bare suffix match.
    return candidateHost.endsWith(`.${allowedHost}`);
  });
}

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
    if (a >= 224) return true; // multicast and reserved/broadcast
    if (a === 198 && b === 51 && octets[2] === 100) return true; // documentation
    if (a === 203 && b === 0 && octets[2] === 113) return true; // documentation
    return false;
  }

  // IPv6 — normalize common forms without pulling in a full IP library.
  const lower = ip.toLowerCase();
  if (lower === '::1') return true; // loopback
  if (lower === '::') return true; // unspecified
  if (lower.startsWith('fe80:') || lower.startsWith('fe80::')) return true; // link-local
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique local (fc00::/7)
  if (lower.startsWith('ff')) return true; // multicast
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
  if (!isOriginAllowed(url, options)) {
    return { allowed: false, reason: `origin_not_allowlisted:${url.protocol}//${url.host}` };
  }
  return { allowed: true };
}

/**
 * Resolves the URL's hostname and rejects if any resolved address is private/reserved —
 * DNS-rebinding-resistant because it checks the address actually about to be connected to, not
 * the hostname. Call this immediately before each navigation/connection attempt (not once
 * up-front and cached), since a hostname's resolution can change between checks.
 */
export async function checkResolvedTarget(
  rawUrl: string,
  allowPrivateTargets = false,
  resolveHostname: (hostname: string) => Promise<readonly string[]> = defaultResolveHostname,
): Promise<NavigationCheckResult> {
  const url = parseUrlSafely(rawUrl);
  if (!url) {
    return { allowed: false, reason: 'unparseable_url' };
  }
  if (allowPrivateTargets) {
    return { allowed: true };
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  // A bare IP in the URL itself (e.g. http://169.254.169.254/) has no DNS step — check directly.
  if (isPrivateOrReservedIp(hostname)) {
    return { allowed: false, reason: `resolved_to_private_ip:${url.hostname}` };
  }
  let addresses: readonly string[];
  try {
    addresses = isIP(hostname) ? [hostname] : await resolveHostname(hostname);
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

/** Returns all addresses from the same fresh lookup used for browser hostname pinning. */
export async function resolveTargetAddresses(
  rawUrl: string,
  resolveHostname: (hostname: string) => Promise<readonly string[]> = defaultResolveHostname,
): Promise<readonly string[]> {
  const url = parseUrlSafely(rawUrl);
  if (!url) throw new Error('unparseable_url');
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(hostname)) return [hostname];
  const addresses = await resolveHostname(hostname);
  if (addresses.length === 0) throw new Error('dns_resolution_empty');
  return addresses;
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
  return checkResolvedTarget(rawUrl, options.allowPrivateTargets ?? false, options.resolveHostname);
}

/** WebSocket origins use ws/wss while run allowlists use their HTTP equivalents. */
export async function checkWebSocketTarget(
  rawUrl: string,
  options: NavigationCheckOptions,
): Promise<NavigationCheckResult> {
  const url = parseUrlSafely(rawUrl);
  if (!url || (url.protocol !== 'ws:' && url.protocol !== 'wss:')) {
    return { allowed: false, reason: `disallowed_websocket_scheme:${url?.protocol ?? 'invalid'}` };
  }
  url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:';
  return checkNavigationTarget(url.href, options);
}

/** Rechecks every URL independently; no DNS answer or redirect decision is cached. */
export async function checkRedirectChain(
  urls: readonly string[],
  options: NavigationCheckOptions,
): Promise<NavigationCheckResult> {
  for (const url of urls) {
    const result = await checkNavigationTarget(url, options);
    if (!result.allowed) return result;
  }
  return { allowed: true };
}
