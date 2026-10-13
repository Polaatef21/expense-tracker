import { request } from './client.js';

export const categoriesApi = {
  list: (signal) => request('/categories', { signal }).then((r) => r.data),
  create: (data) => request('/categories', { method: 'POST', body: data }).then((r) => r.data),
  update: (id, data) => request(`/categories/${id}`, { method: 'PUT', body: data }).then((r) => r.data),
  remove: (id) => request(`/categories/${id}`, { method: 'DELETE' }),
};
