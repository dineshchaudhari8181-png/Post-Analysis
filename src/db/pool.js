const { Pool } = require('pg');
const config = require('../config');

// Validate DATABASE_URL format
const dbUrl = config.database.url;
if (!dbUrl || !dbUrl.startsWith('postgres://') && !dbUrl.startsWith('postgresql://')) {
  console.error('Invalid DATABASE_URL format. Expected postgres:// or postgresql://');
  console.error('DATABASE_URL starts with:', dbUrl ? dbUrl.substring(0, 20) : 'undefined');
  throw new Error('Invalid DATABASE_URL format');
}

// Log connection info (without password)
try {
  const urlObj = new URL(dbUrl);
  console.log('Database connection:', {
    host: urlObj.hostname,
    port: urlObj.port,
    database: urlObj.pathname.replace('/', ''),
    user: urlObj.username,
  });
} catch (e) {
  console.warn('Could not parse DATABASE_URL for logging');
}

const pool = new Pool({
  connectionString: dbUrl,
  ssl: config.app.env === 'production' ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('Unexpected PG pool error', err);
  process.exit(1);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};


