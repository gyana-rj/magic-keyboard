import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The real api/*.ts entry points, imported fresh with the token stubbed empty so nothing can reach GitHub:
 * valid requests end in a friendly "server not set up" error, which is enough to prove the wiring.
 */
async function load() {
  vi.resetModules();
  vi.stubEnv('GITHUB_TOKEN', '');
  vi.stubEnv('PUBLIC_URL', 'https://symphony.example/ignored/path');
  return {
    contributions: (await import('../api/contributions')).GET,
    share: (await import('../api/share')).GET,
    og: (await import('../api/og')).GET,
  };
}
const from = (ip: string) => ({ headers: { 'x-forwarded-for': ip } });

beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
afterEach(() => vi.unstubAllEnvs());

describe('api/contributions entry', () => {
  it('rate limits per client after 30 requests a minute', async () => {
    const { contributions } = await load();
    const call = (ip: string) => contributions(new Request('https://x.example/api/contributions?user=octocat&year=2025', from(ip)));
    for (let i = 0; i < 30; i++) expect((await call('1.1.1.1')).status).toBe(500); // token not set: friendly error
    const blocked = await call('1.1.1.1');
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('retry-after')).toBeTruthy();
    expect((await call('2.2.2.2')).status).toBe(500); // another client is unaffected
  });
  it('rejects unknown parameters and bad input before anything else', async () => {
    const { contributions } = await load();
    const res = await contributions(new Request('https://x.example/api/contributions?user=octocat&year=2025&cachebust=1'));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('invalid_request');
    expect((await contributions(new Request('https://x.example/api/contributions?user=-x'))).status).toBe(400);
  });
  it('never puts the token or internals in an error body', async () => {
    vi.stubEnv('GITHUB_TOKEN', 'ghp_supersecret');
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 401 })));
    const { GET } = await import('../api/contributions');
    const text = await (await GET(new Request('https://x.example/api/contributions?user=octocat&year=2025'))).text();
    expect(text).not.toContain('ghp_supersecret');
    expect(text).not.toMatch(/Bearer|Authorization/i);
    vi.unstubAllGlobals();
  });
});

describe('api/share and api/og entries', () => {
  it('share: serves generic tags with the pinned PUBLIC_URL (not the request host), even when the source fails', async () => {
    const { share } = await load();
    const res = await share(new Request('https://evil.example/api/share?user=octocat&year=2025'));
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('content="https://symphony.example/"');
    expect(html).not.toContain('evil.example');
  });
  it('share: invalid input is a 404 that never reaches GitHub', async () => {
    const { share } = await load();
    expect((await share(new Request('https://x.example/api/share?user=-bad&year=2025'))).status).toBe(404);
  });
  it('og: always answers with a PNG, using the pinned host', async () => {
    const { og } = await load();
    const res = await og(new Request('https://x.example/api/og?user=octocat&year=2025'));
    expect(res.headers.get('content-type')).toBe('image/png');
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect([...bytes.slice(1, 4)]).toEqual([0x50, 0x4e, 0x47]);
  }, 20_000);
  it('share and og share the limiter with the data endpoint, per instance', async () => {
    const { og } = await load();
    const call = () => og(new Request('https://x.example/api/og?user=octocat&year=2025', from('9.9.9.9')));
    let last = 0;
    for (let i = 0; i < 31; i++) last = (await call()).status;
    expect(last).toBe(429);
  }, 60_000);
});
