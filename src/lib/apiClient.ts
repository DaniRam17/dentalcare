const API_URL = '/api';

export const apiClient = {
  async request(endpoint: string, options: any = {}) {
    const token = localStorage.getItem('token');
    const isFormData = options.body instanceof FormData;
    const headers = {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    };

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : null;

    if (!response.ok) {
      throw new Error(data.error || 'Algo salió mal');
    }

    return data;
  },

  get(endpoint: string, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  },

  post(endpoint: string, body: any, options = {}) {
    return this.request(endpoint, { ...options, method: 'POST', body: body instanceof FormData ? body : JSON.stringify(body) });
  },

  put(endpoint: string, body: any, options = {}) {
    return this.request(endpoint, { ...options, method: 'PUT', body: JSON.stringify(body) });
  },

  patch(endpoint: string, body: any, options = {}) {
    return this.request(endpoint, { ...options, method: 'PATCH', body: JSON.stringify(body) });
  },

  delete(endpoint: string, options = {}) {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  },
};
