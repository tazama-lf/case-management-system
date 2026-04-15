/* eslint-disable @typescript-eslint/no-unsafe-assignment -- Service handles dynamic API response data */
/* eslint-disable @typescript-eslint/class-methods-use-this -- Service methods are called on instances */
import authService from '../../features/auth/services/authService';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:3000';

interface ApiRequestOptions extends RequestInit {
  skipAuth?: boolean;
}

class ApiClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: ApiRequestOptions = {},
  ): Promise<T> {
    const { skipAuth = false, ...fetchOptions } = options;

    const url = `${this.baseUrl}${endpoint}`;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(fetchOptions.headers as Record<string, string>),
    };

    if (!skipAuth) {
      const authHeaders = authService.getAuthHeader();
      Object.assign(headers, authHeaders);
    }

    const config: RequestInit = {
      ...fetchOptions,
      headers,
    };

    try {
      const response = await fetch(url, config);

      if (response.status === 401 && !skipAuth) {
        const refreshed = await authService.refreshUserProfile();
        if (refreshed) {
          const newAuthHeaders = authService.getAuthHeader();
          const retryConfig: RequestInit = {
            ...config,
            headers: {
              ...headers,
              ...newAuthHeaders,
            },
          };
          const retryResponse = await fetch(url, retryConfig);
          return await this.handleResponse<T>(retryResponse);
        } else {
          authService.logout();
          window.location.href = '/login';
          throw new Error('Session expired. Please login again.');
        }
      }

      return await this.handleResponse<T>(response);
    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error);
      throw error;
    }
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as {
        message?: string;
      };
      throw new Error(
        errorData.message ?? `HTTP ${response.status}: ${response.statusText}`,
      );
    }

    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return (await response.json()) as T;
    }

    return (await response.text()) as unknown as T;
  }

  async get<T>(endpoint: string, options?: ApiRequestOptions): Promise<T> {
    return await this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  async post<T>(
    endpoint: string,
    data?: unknown,
    options?: ApiRequestOptions,
  ): Promise<T> {
    return await this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(
    endpoint: string,
    data?: unknown,
    options?: ApiRequestOptions,
  ): Promise<T> {
    return await this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(
    endpoint: string,
    data?: unknown,
    options?: ApiRequestOptions,
  ): Promise<T> {
    return await this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string, options?: ApiRequestOptions): Promise<T> {
    return await this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  async upload<T>(
    endpoint: string,
    formData: FormData,
    options?: ApiRequestOptions,
  ): Promise<T> {
    const { skipAuth = false, ...fetchOptions } = options ?? {};

    const url = `${this.baseUrl}${endpoint}`;

    // For multipart uploads, we need to handle auth headers manually
    // and NOT set Content-Type (browser will set it with boundary)
    const headers: HeadersInit = {
      ...(fetchOptions.headers as Record<string, string>),
    };

    if (!skipAuth) {
      const authHeaders = authService.getAuthHeader();
      Object.assign(headers, authHeaders);
    }

    // Remove Content-Type if it exists - browser will set it automatically for FormData
    if ('Content-Type' in headers) {
       
      delete (headers)['Content-Type'];
    }

    const config: RequestInit = {
      ...fetchOptions,
      method: 'POST',
      body: formData,
      headers,
    };

    try {
      const response = await fetch(url, config);

      if (response.status === 401 && !skipAuth) {
        const refreshed = await authService.refreshUserProfile();
        if (refreshed) {
          const newAuthHeaders = authService.getAuthHeader();
          const retryHeaders = { ...headers, ...newAuthHeaders };
          if ('Content-Type' in retryHeaders) {
             
            delete (retryHeaders as Record<string, string>)['Content-Type'];
          }
          const retryConfig: RequestInit = {
            ...config,
            headers: retryHeaders,
          };
          const retryResponse = await fetch(url, retryConfig);
          return await this.handleResponse<T>(retryResponse);
        } else {
          authService.logout();
          window.location.href = '/login';
          throw new Error('Session expired. Please login again.');
        }
      }

      return await this.handleResponse<T>(response);
    } catch (error) {
      console.error(`API upload failed: ${endpoint}`, error);
      throw error;
    }
  }
}

const apiClient = new ApiClient();

export default apiClient;
/* eslint-enable @typescript-eslint/class-methods-use-this */
/* eslint-enable @typescript-eslint/no-unsafe-assignment */
