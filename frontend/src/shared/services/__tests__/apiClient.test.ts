import apiClient from '../apiClient';
import authService from '../../../features/auth/services/authService';
import { vi } from 'vitest';

describe('apiClient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('performs GET and returns JSON', async () => {
    const mockData = { hello: 'world' };
    const res = new Response(JSON.stringify(mockData), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });

    const fetchMock = vi.fn().mockResolvedValue(res);
    vi.stubGlobal('fetch', fetchMock);

    vi.spyOn(authService, 'getAuthHeader').mockReturnValue({ Authorization: 'Bearer tok' });

    const result = await apiClient.get('/test');
    expect(result).toEqual(mockData);
    expect(fetchMock).toHaveBeenCalled();
  });

  it('throws an error for non-ok responses with message', async () => {
    const res = new Response(JSON.stringify({ message: 'Bad' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
      statusText: 'Server Error',
    });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res));

    await expect(apiClient.get('/bad')).rejects.toThrow('Bad');
  });

  it('retries on 401 when refreshUserProfile returns truthy', async () => {
    const res401 = new Response(JSON.stringify({}), { status: 401 });
    const res200 = new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });

    const fetchMock = vi.fn().mockResolvedValueOnce(res401).mockResolvedValueOnce(res200);
    vi.stubGlobal('fetch', fetchMock);

    vi.spyOn(authService, 'getAuthHeader').mockReturnValue({ Authorization: 'Bearer old' });
    vi.spyOn(authService, 'refreshUserProfile').mockResolvedValue({ userId: 'u1' } as any);
    vi.spyOn(authService, 'getAuthHeader').mockReturnValueOnce({ Authorization: 'Bearer old' }).mockReturnValueOnce({ Authorization: 'Bearer new' });

    const result = await apiClient.get('/retry');
    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(authService.refreshUserProfile).toHaveBeenCalled();
  });

  it('calls logout and navigates to login when refresh fails', async () => {
    const res401 = new Response(JSON.stringify({}), { status: 401 });
    const fetchMock = vi.fn().mockResolvedValue(res401);
    vi.stubGlobal('fetch', fetchMock);

    vi.spyOn(authService, 'getAuthHeader').mockReturnValue({});
    vi.spyOn(authService, 'refreshUserProfile').mockResolvedValue(null);
    const logoutSpy = vi.spyOn(authService, 'logout').mockImplementation(() => {});

    const originalHref = window.location.href;
    delete (window as any).location;
    (window as any).location = { href: '' };

    await expect(apiClient.get('/expired')).rejects.toThrow();
    expect(logoutSpy).toHaveBeenCalled();
    expect((window as any).location.href).toBe('/login');

    // restore location
    (window as any).location = { href: originalHref };
  });
});
