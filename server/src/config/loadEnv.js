// Loads server/.env into process.env exactly once, regardless of the current
// working directory. Existing environment variables are never overwritten.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config({
  path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.env'),
  quiet: true,
});
