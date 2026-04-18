import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database('sessions.db');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    deviceName TEXT,
    ipAddress TEXT,
    location TEXT,
    userAgent TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    lastActive DATETIME DEFAULT CURRENT_TIMESTAMP,
    isRevoked BOOLEAN DEFAULT 0,
    expiresAt DATETIME,
    deviceId TEXT
  );

  CREATE TABLE IF NOT EXISTS user_settings (
    userId TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS activity_logs (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    type TEXT,
    action TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS mfa_secrets (
    userId TEXT PRIMARY KEY,
    secret TEXT NOT NULL,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

export default db;
