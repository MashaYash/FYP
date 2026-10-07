-- init/01_create_users.sql

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password TEXT NOT NULL,
    phone VARCHAR(30),
    date_of_birth DATE,
    age VARCHAR(30),
    gender VARCHAR(20),
    address TEXT,
    blood_type VARCHAR(10),
    known_allergies TEXT,
    emergency_contact_name VARCHAR(150),
    emergency_contact_phone VARCHAR(30),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reports (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    report_date TIMESTAMP NOT NULL,
    report JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

-- Migrate existing TEXT column to JSONB if the table was created with the old schema
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'reports'
          AND column_name = 'report'
          AND data_type = 'text'
    ) THEN
        ALTER TABLE reports
            ALTER COLUMN report TYPE JSONB USING report::jsonb;
    END IF;
END
$$;
