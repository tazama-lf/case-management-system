import CryptoJS from 'crypto-js';
import { vi, beforeEach, afterEach } from 'vitest';

// Mock the crypto module entirely
vi.mock('@/shared/utils/crypto', () => {
  const mockKey = 'test-secret-key-123';

  return {
    encrypt: (data: unknown): string => {
      const stringified = JSON.stringify(data);
      return CryptoJS.AES.encrypt(stringified, mockKey).toString();
    },
    decrypt: (encryptedData: string): unknown => {
      const bytes = CryptoJS.AES.decrypt(encryptedData, mockKey);
      const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
      if (!decryptedString) {
        throw new Error('Failed to decrypt data');
      }
      return JSON.parse(decryptedString) as unknown;
    },
  };
});

import apiClient from '../apiClient';
import authService from '../../../features/auth/services/authService';

describe('apiClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

    vi.spyOn(authService, 'getAuthHeader').mockReturnValue({
      Authorization: 'Bearer tok',
    });

    const result = await apiClient.get('/test');
    expect(result).toEqual(mockData);
    expect(fetchMock).toHaveBeenCalled();
  });

  it('performs POST with data', async () => {
    const mockData = { id: '1', name: 'Test' };
    const res = new Response(JSON.stringify(mockData), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });

    const fetchMock = vi.fn().mockResolvedValue(res);
    vi.stubGlobal('fetch', fetchMock);

    vi.spyOn(authService, 'getAuthHeader').mockReturnValue({
      Authorization: 'Bearer tok',
    });

    const result = await apiClient.post('/test', { name: 'Test' });
    expect(result).toEqual(mockData);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/test'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'Test' }),
      }),
    );
  });

  it('performs PUT with data', async () => {
    const mockData = { id: '1', name: 'Updated' };
    const res = new Response(JSON.stringify(mockData), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });

    const fetchMock = vi.fn().mockResolvedValue(res);
    vi.stubGlobal('fetch', fetchMock);

    vi.spyOn(authService, 'getAuthHeader').mockReturnValue({
      Authorization: 'Bearer tok',
    });

    const result = await apiClient.put('/test/1', { name: 'Updated' });
    expect(result).toEqual(mockData);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/test/1'),
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ name: 'Updated' }),
      }),
    );
  });

  it('performs PATCH with data', async () => {
    const mockData = { id: '1', name: 'Patched' };
    const res = new Response(JSON.stringify(mockData), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });

    const fetchMock = vi.fn().mockResolvedValue(res);
    vi.stubGlobal('fetch', fetchMock);

    vi.spyOn(authService, 'getAuthHeader').mockReturnValue({
      Authorization: 'Bearer tok',
    });

    const result = await apiClient.patch('/test/1', { name: 'Patched' });
    expect(result).toEqual(mockData);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/test/1'),
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ name: 'Patched' }),
      }),
    );
  });

  it('performs DELETE', async () => {
    const res = new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });

    const fetchMock = vi.fn().mockResolvedValue(res);
    vi.stubGlobal('fetch', fetchMock);

    vi.spyOn(authService, 'getAuthHeader').mockReturnValue({
      Authorization: 'Bearer tok',
    });

    const result = await apiClient.delete('/test/1');
    expect(result).toEqual({ success: true });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/test/1'),
      expect.objectContaining({
        method: 'DELETE',
      }),
    );
  });

  it('handles text responses', async () => {
    const res = new Response('Plain text response', {
      status: 200,
      headers: { 'content-type': 'text/plain' },
    });

    const fetchMock = vi.fn().mockResolvedValue(res);
    vi.stubGlobal('fetch', fetchMock);

    vi.spyOn(authService, 'getAuthHeader').mockReturnValue({
      Authorization: 'Bearer tok',
    });

    const result = await apiClient.get('/text');
    expect(result).toBe('Plain text response');
  });

  it('skips auth when skipAuth is true', async () => {
    const mockData = { public: 'data' };
    const res = new Response(JSON.stringify(mockData), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });

    const fetchMock = vi.fn().mockResolvedValue(res);
    vi.stubGlobal('fetch', fetchMock);

    const getAuthHeaderSpy = vi.spyOn(authService, 'getAuthHeader');

    const result = await apiClient.get('/public', { skipAuth: true });
    expect(result).toEqual(mockData);
    expect(getAuthHeaderSpy).not.toHaveBeenCalled();
  });

  it('throws an error for non-ok responses with message', async () => {
    const res = new Response(JSON.stringify({ message: 'Bad' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
      statusText: 'Server Error',
    });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res));
    vi.spyOn(authService, 'getAuthHeader').mockReturnValue({
      Authorization: 'Bearer tok',
    });

    await expect(apiClient.get('/bad')).rejects.toThrow('Bad');
  });

  it('throws error with status text when message is missing', async () => {
    const res = new Response('', {
      status: 404,
      statusText: 'Not Found',
    });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res));
    vi.spyOn(authService, 'getAuthHeader').mockReturnValue({
      Authorization: 'Bearer tok',
    });

    await expect(apiClient.get('/notfound')).rejects.toThrow(
      'HTTP 404: Not Found',
    );
  });

  it('retries on 401 when refreshUserProfile returns truthy', async () => {
    const res401 = new Response(JSON.stringify({}), { status: 401 });
    const res200 = new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(res401)
      .mockResolvedValueOnce(res200);
    vi.stubGlobal('fetch', fetchMock);

    vi.spyOn(authService, 'getAuthHeader')
      .mockReturnValueOnce({ Authorization: 'Bearer old' })
      .mockReturnValueOnce({ Authorization: 'Bearer new' });
    vi.spyOn(authService, 'refreshUserProfile').mockResolvedValue({
      userId: 'u1',
    } as any);

    const result = await apiClient.get('/retry');
    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(authService.refreshUserProfile).toHaveBeenCalled();
  });

  it('calls logout and navigates to login when refresh fails', async () => {
    const res401 = new Response(JSON.stringify({}), { status: 401 });
    const fetchMock = vi.fn().mockResolvedValue(res401);
    vi.stubGlobal('fetch', fetchMock);

    vi.spyOn(authService, 'getAuthHeader').mockReturnValue({
      Authorization: 'Bearer tok',
    });
    vi.spyOn(authService, 'refreshUserProfile').mockResolvedValue(null);
    const logoutSpy = vi
      .spyOn(authService, 'logout')
      .mockImplementation(() => {});

    const originalHref = window.location.href;
    delete (window as any).location;
    (window as any).location = { href: '' };

    await expect(apiClient.get('/expired')).rejects.toThrow('Session expired');
    expect(logoutSpy).toHaveBeenCalled();
    expect((window as any).location.href).toBe('/login');

    // restore location
    (window as any).location = { href: originalHref };
  });

  it('handles upload with FormData', async () => {
    const mockData = { success: true, fileId: '123' };
    const res = new Response(JSON.stringify(mockData), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });

    const fetchMock = vi.fn().mockResolvedValue(res);
    vi.stubGlobal('fetch', fetchMock);

    vi.spyOn(authService, 'getAuthHeader').mockReturnValue({
      Authorization: 'Bearer tok',
    });

    const formData = new FormData();
    formData.append(
      'file',
      new Blob(['test'], { type: 'text/plain' }),
      'test.txt',
    );

    const result = await apiClient.upload('/upload', formData);
    expect(result).toEqual(mockData);
    expect(fetchMock).toHaveBeenCalled();
    const callArgs = fetchMock.mock.calls[0];
    expect(callArgs[1]?.body).toBeInstanceOf(FormData);
  });

  it('handles upload 401 retry', async () => {
    const res401 = new Response(JSON.stringify({}), { status: 401 });
    const res200 = new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(res401)
      .mockResolvedValueOnce(res200);
    vi.stubGlobal('fetch', fetchMock);

    vi.spyOn(authService, 'getAuthHeader')
      .mockReturnValueOnce({ Authorization: 'Bearer old' })
      .mockReturnValueOnce({ Authorization: 'Bearer new' });
    vi.spyOn(authService, 'refreshUserProfile').mockResolvedValue({
      userId: 'u1',
    } as any);

    const formData = new FormData();
    formData.append('file', new Blob(['test']), 'test.txt');

    const result = await apiClient.upload('/upload', formData);
    expect(result).toEqual({ success: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('handles upload with skipAuth', async () => {
    const mockData = { success: true };
    const res = new Response(JSON.stringify(mockData), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });

    const fetchMock = vi.fn().mockResolvedValue(res);
    vi.stubGlobal('fetch', fetchMock);

    const getAuthHeaderSpy = vi.spyOn(authService, 'getAuthHeader');

    const formData = new FormData();
    formData.append('file', new Blob(['test']), 'test.txt');

    const result = await apiClient.upload('/public-upload', formData, {
      skipAuth: true,
    });
    expect(result).toEqual(mockData);
    expect(getAuthHeaderSpy).not.toHaveBeenCalled();
  });

  it('logs error on request failure', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('Network error');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(error));
    vi.spyOn(authService, 'getAuthHeader').mockReturnValue({
      Authorization: 'Bearer tok',
    });

    await expect(apiClient.get('/error')).rejects.toThrow('Network error');
    expect(consoleSpy).toHaveBeenCalledWith(
      'API request failed: /error',
      error,
    );

    consoleSpy.mockRestore();
  });

  it('logs error on upload failure', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('Upload error');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(error));
    vi.spyOn(authService, 'getAuthHeader').mockReturnValue({
      Authorization: 'Bearer tok',
    });

    const formData = new FormData();
    formData.append('file', new Blob(['test']), 'test.txt');

    await expect(apiClient.upload('/upload', formData)).rejects.toThrow(
      'Upload error',
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      'API upload failed: /upload',
      error,
    );

    consoleSpy.mockRestore();
  });
});
