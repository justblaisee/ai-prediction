import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        const response = await axios.post(`${API_URL}/api/auth/refresh`, {
          refreshToken,
        });
        
        const { accessToken, refreshToken: newRefreshToken } = response.data;
        
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', newRefreshToken);
        
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    organizationName?: string;
  }) => api.post('/auth/register', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
};

// Products API
export const productsApi = {
  list: (params?: { page?: number; limit?: number; search?: string; category?: string }) =>
    api.get('/products', { params }),
  getAll: (params?: { page?: number; limit?: number; search?: string; category?: string }) =>
    api.get('/products', { params }),
  getById: (id: string) => api.get(`/products/${id}`),
  create: (data: any) => api.post('/products', data),
  update: (id: string, data: any) => api.patch(`/products/${id}`, data),
  delete: (id: string) => api.delete(`/products/${id}`),
  getCategories: () => api.get('/products/meta/categories'),
};

// Transactions API
export const transactionsApi = {
  getAll: (params?: {
    page?: number;
    limit?: number;
    productId?: string;
    startDate?: string;
    endDate?: string;
    type?: string;
  }) => api.get('/transactions', { params }),
  create: (data: any) => api.post('/transactions', data),
  bulk: (data: any[]) => api.post('/transactions/bulk', data),
  getSummary: (params?: { startDate?: string; endDate?: string }) =>
    api.get('/transactions/summary', { params }),
};

// Predictions API
export const predictionsApi = {
  getForProduct: (productId: string, days?: number) =>
    api.get(`/predictions/product/${productId}`, { params: { days } }),
  getStockout: (productId: string) => api.get(`/predictions/stockout/${productId}`),
  train: (productId: string) => api.post(`/predictions/train/${productId}`),
  getTrainStatus: (productId: string) => api.get(`/predictions/train-status/${productId}`),
  getAlerts: (threshold?: number) =>
    api.get('/predictions/alerts', { params: { threshold } }),
  getDashboardPredictions: (days?: number) =>
    api.get('/predictions/dashboard', { params: { days } }),
};

// Alerts API
export const alertsApi = {
  list: (params?: {
    page?: number;
    limit?: number;
    unread?: boolean;
    type?: string;
    severity?: string;
  }) => api.get('/alerts', { params }),
  getAll: (params?: {
    page?: number;
    limit?: number;
    unread?: boolean;
    type?: string;
    severity?: string;
  }) => api.get('/alerts', { params }),
  markAsRead: (id: string) => api.patch(`/alerts/${id}/read`),
  markAllAsRead: () => api.post('/alerts/read-all'),
  delete: (id: string) => api.delete(`/alerts/${id}`),
  getStats: () => api.get('/alerts/stats'),
};
