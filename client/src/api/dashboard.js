import { request } from './client.js';

export const dashboardApi = {
  summary: ({ startDate, endDate }, signal) => request('/dashboard', { query: { startDate, endDate }, signal }),
};
