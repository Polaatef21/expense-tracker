// Client-side checks that mirror the server rules, for instant feedback.
// The server still validates everything; these only improve the experience.
export const AMOUNT_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateTransaction({ type, categoryId, amount, date, description }) {
  const errors = {};
  if (type !== 'income' && type !== 'expense') errors.type = 'Choose income or expense';
  if (!categoryId) errors.categoryId = 'Choose a category';
  const trimmed = String(amount ?? '').trim();
  if (!trimmed) errors.amount = 'Enter an amount';
  else if (!AMOUNT_PATTERN.test(trimmed)) errors.amount = 'Use a positive number with up to 2 decimals';
  else if (Number(trimmed) <= 0) errors.amount = 'Amount must be greater than 0';
  if (!date) errors.date = 'Choose a date';
  if ([...(description ?? '').trim()].length > 255) errors.description = 'Keep it under 255 characters';
  return errors;
}

export function validateRegistration({ name, email, password, confirmPassword }) {
  const errors = {};
  if (!name.trim()) errors.name = 'Enter your name';
  else if (name.trim().length > 100) errors.name = 'Name must be at most 100 characters';
  if (!EMAIL_PATTERN.test(email.trim())) errors.email = 'Enter a valid email address';
  if (password.length < 8) errors.password = 'Use at least 8 characters';
  else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) errors.password = 'Include at least one letter and one number';
  else if (new TextEncoder().encode(password).length > 72) errors.password = 'Password is too long';
  if (confirmPassword !== password) errors.confirmPassword = 'Passwords do not match';
  return errors;
}
