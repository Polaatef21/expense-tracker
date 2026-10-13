import { filenameFromDisposition, saveBlob } from '../utils/download.js';
import { request } from './client.js';

export const transactionsApi = {
  // filters: { startDate, endDate, type, categoryId, page, pageSize }
  list: (filters, signal) => request('/transactions', { query: filters, signal }),
  create: (data) => request('/transactions', { method: 'POST', body: data }).then((r) => r.data),
  update: (id, data) => request(`/transactions/${id}`, { method: 'PUT', body: data }).then((r) => r.data),
  remove: (id) => request(`/transactions/${id}`, { method: 'DELETE' }),

  // Downloads the filtered transactions as a file. Uses fetch (not a plain link)
  // so the Authorization header is sent and the token never appears in a URL.
  async exportFile(format, filters) {
    const response = await request('/transactions/export', { query: { ...filters, format }, raw: true });
    const blob = await response.blob();
    const name = filenameFromDisposition(response.headers.get('Content-Disposition')) ?? `transactions.${format}`;
    saveBlob(blob, name);
    return name;
  },
};
