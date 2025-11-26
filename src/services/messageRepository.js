const db = require('../db/pool');
const {
  computeEmojiSentiment,
  computeReplySentiment,
  blendSentimentScores,
} = require('./sentiment');

async function saveMessage({ slackTs, channel, user, text }) {
  const query = `
    INSERT INTO messages (slack_ts, channel_id, channel_name, user_id, username, text)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (slack_ts) DO UPDATE
      SET text = EXCLUDED.text,
          channel_name = COALESCE(EXCLUDED.channel_name, messages.channel_name),
          username = COALESCE(EXCLUDED.username, messages.username)
    RETURNING *;
  `;
  const params = [slackTs, channel.id, channel.name, user.id, user.username, text];
  const { rows } = await db.query(query, params);
  return rows[0];
}

async function saveReply({ messageTs, replyTs, user, text, sentimentScore, sentimentLabel }) {
  const query = `
    INSERT INTO replies (message_ts, reply_ts, user_id, username, text, sentiment_score, sentiment_label)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (reply_ts) DO UPDATE
      SET text = EXCLUDED.text,
          sentiment_score = EXCLUDED.sentiment_score,
          sentiment_label = EXCLUDED.sentiment_label
    RETURNING *;
  `;
  const params = [
    messageTs,
    replyTs,
    user.id,
    user.username,
    text,
    sentimentScore,
    sentimentLabel,
  ];
  const { rows } = await db.query(query, params);
  return rows[0];
}

async function addReaction({ messageTs, emoji, user, reactionTs }) {
  const query = `
    INSERT INTO reactions (message_ts, emoji, user_id, username, reaction_ts)
    VALUES ($1, $2, $3, $4, to_timestamp($5::double precision))
    ON CONFLICT (message_ts, emoji, user_id)
    DO UPDATE SET reaction_ts = EXCLUDED.reaction_ts
    RETURNING *;
  `;
  const params = [messageTs, emoji, user.id, user.username, reactionTs];
  const { rows } = await db.query(query, params);
  return rows[0];
}

async function removeReaction({ messageTs, emoji, userId }) {
  await db.query(
    'DELETE FROM reactions WHERE message_ts = $1 AND emoji = $2 AND user_id = $3',
    [messageTs, emoji, userId],
  );
}

async function getReactions(messageTs) {
  const query = `
    SELECT
      emoji,
      COUNT(*) AS count,
      json_agg(
        json_build_object(
          'id', user_id,
          'username', username
        )
        ORDER BY username
      ) AS users
    FROM reactions
    WHERE message_ts = $1
    GROUP BY emoji
    ORDER BY count DESC;
  `;
  const { rows } = await db.query(query, [messageTs]);
  return rows.map((row) => ({
    emoji: row.emoji,
    count: Number(row.count),
    users: row.users || [],
  }));
}

async function getReplies(messageTs) {
  const query = `
    SELECT reply_ts, user_id, username, text, sentiment_score, sentiment_label, created_at
    FROM replies
    WHERE message_ts = $1
    ORDER BY created_at ASC;
  `;
  const { rows } = await db.query(query, [messageTs]);
  return rows;
}

async function getMessageByTs(messageTs) {
  const query = `
    SELECT *
    FROM messages
    WHERE slack_ts = $1
    LIMIT 1;
  `;
  const { rows } = await db.query(query, [messageTs]);
  return rows[0];
}

async function recalculateSentiment(messageTs) {
  const [reactions, replies] = await Promise.all([
    getReactions(messageTs),
    getReplies(messageTs),
  ]);
  const emojiSentiment = computeEmojiSentiment(reactions);
  const replySentiment = computeReplySentiment(replies);
  const combined = blendSentimentScores(emojiSentiment, replySentiment);

  await db.query(
    `
    UPDATE messages
    SET emoji_sentiment = $2,
        reply_sentiment = $3,
        combined_sentiment = $4
    WHERE slack_ts = $1
    `,
    [messageTs, emojiSentiment, replySentiment, combined],
  );

  return { reactions, replies, emojiSentiment, replySentiment, combined };
}

async function getMessageSummary(channelId, messageTs) {
  const message = await getMessageByTs(messageTs);
  if (!message) return null;
  const { reactions, replies, emojiSentiment, replySentiment, combined } = await recalculateSentiment(
    messageTs,
  );

  return {
    message,
    reactions,
    replies,
    emojiSentiment,
    replySentiment,
    combinedSentiment: combined,
    totalReplies: replies.length,
    channelId,
  };
}

module.exports = {
  saveMessage,
  saveReply,
  addReaction,
  removeReaction,
  getMessageSummary,
  recalculateSentiment,
  getMessageByTs,
};


