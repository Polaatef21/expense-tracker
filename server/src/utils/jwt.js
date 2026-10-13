import jwt from 'jsonwebtoken';

// The token only carries the user id (`sub`) and expiry — no personal data,
// because anyone holding a JWT can read its payload.
export function signToken(userId, { jwtSecret, jwtExpiresIn }) {
  return jwt.sign({}, jwtSecret, {
    subject: String(userId),
    expiresIn: jwtExpiresIn,
    algorithm: 'HS256',
  });
}

// Throws jsonwebtoken errors (TokenExpiredError, JsonWebTokenError) on any problem.
// Pinning `algorithms` blocks "alg: none" and algorithm-confusion attacks.
export function verifyToken(token, jwtSecret) {
  const payload = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] });
  if (typeof payload.sub !== 'string' || !/^[1-9]\d{0,15}$/.test(payload.sub)) {
    throw new jwt.JsonWebTokenError('invalid subject');
  }
  return payload;
}
