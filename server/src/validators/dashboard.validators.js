import { z } from 'zod';
import { dateRangeFields, validDateRange } from './common.js';

export const dashboardQuerySchema = z.object(dateRangeFields).refine(...validDateRange);
