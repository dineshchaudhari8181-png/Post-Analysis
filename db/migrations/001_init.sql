CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    slack_ts TEXT UNIQUE NOT NULL,
    channel_id TEXT NOT NULL,
    channel_name TEXT,
    user_id TEXT NOT NULL,
    username TEXT,
    text TEXT,
    emoji_sentiment NUMERIC DEFAULT 0,
    reply_sentiment NUMERIC DEFAULT 0,
    combined_sentiment NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS replies (
    id SERIAL PRIMARY KEY,
    message_ts TEXT NOT NULL REFERENCES messages(slack_ts) ON DELETE CASCADE,
    reply_ts TEXT UNIQUE NOT NULL,
    user_id TEXT NOT NULL,
    username TEXT,
    text TEXT,
    sentiment_score NUMERIC,
    sentiment_label TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reactions (
    id SERIAL PRIMARY KEY,
    message_ts TEXT NOT NULL REFERENCES messages(slack_ts) ON DELETE CASCADE,
    emoji TEXT NOT NULL,
    user_id TEXT NOT NULL,
    username TEXT,
    reaction_ts TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (message_ts, emoji, user_id)
);

CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_replies_message ON replies(message_ts);
CREATE INDEX IF NOT EXISTS idx_reactions_message ON reactions(message_ts);


