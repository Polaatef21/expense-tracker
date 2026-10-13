-- 001_initial_schema.sql
-- Creates users, categories, and transactions.
-- The migration runner wraps this whole file in a single database transaction,
-- so do NOT add BEGIN/COMMIT here.

-- Keeps updated_at current on every UPDATE
CREATE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- ---------- users ----------
CREATE TABLE users (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name          TEXT        NOT NULL,
  email         TEXT        NOT NULL,
  password_hash TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT users_email_unique UNIQUE (email),
  CONSTRAINT users_email_format CHECK (email = lower(btrim(email))
                                       AND char_length(email) BETWEEN 3 AND 254
                                       AND position('@' IN email) > 1),
  CONSTRAINT users_name_length  CHECK (name = btrim(name)
                                       AND char_length(name) BETWEEN 1 AND 100)
);

-- ---------- categories ----------
CREATE TABLE categories (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  type       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT categories_type_check  CHECK (type IN ('income', 'expense')),
  CONSTRAINT categories_name_format CHECK (name = btrim(name)
                                           AND char_length(name) BETWEEN 1 AND 50),
  -- Target of the composite foreign key from transactions
  CONSTRAINT categories_id_user_type_unique UNIQUE (id, user_id, type)
);

-- One "Groceries" per user per type (case-insensitive); also serves "list my categories"
CREATE UNIQUE INDEX categories_user_type_name_unique
  ON categories (user_id, type, lower(name));

-- ---------- transactions ----------
CREATE TABLE transactions (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id          BIGINT        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  category_id      BIGINT        NOT NULL,
  type             TEXT          NOT NULL,
  amount           NUMERIC(12,2) NOT NULL,
  description      TEXT,
  transaction_date DATE          NOT NULL,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT transactions_type_check      CHECK (type IN ('income', 'expense')),
  CONSTRAINT transactions_amount_positive CHECK (amount > 0),
  CONSTRAINT transactions_description_length
    CHECK (description IS NULL
           OR (description = btrim(description) AND char_length(description) BETWEEN 1 AND 255)),

  -- The category must belong to the SAME user and have the SAME type.
  -- NO ACTION (checked at end of statement) blocks deleting a category in use,
  -- while still letting a user deletion cascade through both tables.
  CONSTRAINT transactions_category_fk
    FOREIGN KEY (category_id, user_id, type)
    REFERENCES categories (id, user_id, type)
    ON UPDATE NO ACTION
    ON DELETE NO ACTION
);

-- List / date-range filter / dashboard aggregates / export, newest first
CREATE INDEX transactions_user_date_idx
  ON transactions (user_id, transaction_date DESC, id DESC);

-- Category filter, and the FK check when a category is deleted
CREATE INDEX transactions_category_date_idx
  ON transactions (category_id, transaction_date DESC);

-- ---------- updated_at triggers ----------
CREATE TRIGGER users_set_updated_at        BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER categories_set_updated_at   BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER transactions_set_updated_at BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
