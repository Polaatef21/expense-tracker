import bcrypt from 'bcrypt';
import { AppError } from '../utils/AppError.js';
import { signToken } from '../utils/jwt.js';
import { isUniqueViolation } from '../utils/pgErrors.js';
import { insertDefaultCategories } from './category.service.js';

const toUser = (row) => ({ id: row.id, name: row.name, email: row.email, createdAt: row.created_at });

// Same response for "no such email" and "wrong password", so attackers
// can't use the login form to discover which emails are registered.
const invalidCredentials = () => new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');

export function createAuthService({ db, auth }) {
  let dummyHash; // used to spend the same bcrypt time when the email doesn't exist

  return {
    async register({ name, email, password }) {
      // Hash before opening the transaction: bcrypt is deliberately slow (~250 ms)
      const passwordHash = await bcrypt.hash(password, auth.saltRounds);

      // The user and their default categories are created atomically
      const user = await db.withTransaction(async (client) => {
        let row;
        try {
          ({ rows: [row] } = await client.query(
            `INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)
             RETURNING id, name, email, created_at`,
            [name, email, passwordHash],
          ));
        } catch (err) {
          if (isUniqueViolation(err, 'users_email_unique')) {
            throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists', [
              { field: 'email', message: 'This email is already registered' },
            ]);
          }
          throw err;
        }
        await insertDefaultCategories(client, row.id);
        return toUser(row);
      });

      return { user, token: signToken(user.id, auth) };
    },

    async login({ email, password }) {
      const { rows: [row] } = await db.query(
        'SELECT id, name, email, created_at, password_hash FROM users WHERE email = $1',
        [email],
      );

      if (!row) {
        dummyHash ??= await bcrypt.hash('timing-equalizer-password', auth.saltRounds);
        await bcrypt.compare(password, dummyHash);
        throw invalidCredentials();
      }
      if (!(await bcrypt.compare(password, row.password_hash))) throw invalidCredentials();

      return { user: toUser(row), token: signToken(row.id, auth) };
    },

    async getUser(userId) {
      const { rows: [row] } = await db.query('SELECT id, name, email, created_at FROM users WHERE id = $1', [
        userId,
      ]);
      // A valid token for a user that no longer exists is treated as logged out
      if (!row) throw new AppError(401, 'INVALID_TOKEN', 'Your account was not found. Please log in again.');
      return toUser(row);
    },
  };
}
