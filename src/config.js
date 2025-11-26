const assertEnv = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

module.exports = {
  app: {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development',
  },
  slack: {
    signingSecret: assertEnv('SLACK_SIGNING_SECRET'),
    botToken: assertEnv('SLACK_BOT_TOKEN'),
  },
  database: {
    url: assertEnv('DATABASE_URL'),
  },
  google: {
    apiKey: process.env.GOOGLE_API_KEY || '',
    model: process.env.GEMINI_MODEL || '',
  },
};


