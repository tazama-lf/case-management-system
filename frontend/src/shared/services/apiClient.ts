import authService from '../../features/auth/services/authService';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3000';

interface ApiRequestOptions extends RequestInit {
  skipAuth?: boolean;
}

class ApiClient {
  private baseUrl: string;

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
      ...fetchOptions.headers,
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
        const refreshed = await authService.refreshToken();
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
          return this.handleResponse<T>(retryResponse);
        } else {
          authService.logout();
          window.location.href = '/login';
          throw new Error('Session expired. Please login again.');
        }
      }

      return this.handleResponse<T>(response);
    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error);
      throw error;
    }
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `HTTP ${response.status}: ${response.statusText}`,
      );
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return response.json();
    }

    return response.text() as unknown as T;
  }

  async get<T>(endpoint: string, options?: ApiRequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  async post<T>(
    endpoint: string,
    data?: any,
    options?: ApiRequestOptions,
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(
    endpoint: string,
    data?: any,
    options?: ApiRequestOptions,
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(
    endpoint: string,
    data?: any,
    options?: ApiRequestOptions,
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string, options?: ApiRequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  async upload<T>(
    endpoint: string,
    formData: FormData,
    options?: ApiRequestOptions,
  ): Promise<T> {
    const { skipAuth = false, ...fetchOptions } = options || {};

    const headers: HeadersInit = {
      ...fetchOptions.headers,
    };

    if (headers && 'Content-Type' in headers) {
      delete (headers as any)['Content-Type'];
    }

    return this.request<T>(endpoint, {
      ...fetchOptions,
      method: 'POST',
      body: formData,
      headers,
      skipAuth,
    });
  }
}

const apiClient = new ApiClient();

export default apiClient;
