function escapeCSV(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function generateCSV(summary) {
  const lines = [];
  
  // Header
  lines.push('Post Analysis Export');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  
  // Message Info
  lines.push('=== MESSAGE INFO ===');
  lines.push('Field,Value');
  lines.push(`Message ID,${escapeCSV(summary.message.slack_ts)}`);
  lines.push(`Channel ID,${escapeCSV(summary.message.channel_id)}`);
  lines.push(`Channel Name,${escapeCSV(summary.message.channel_name)}`);
  lines.push(`User ID,${escapeCSV(summary.message.user_id)}`);
  lines.push(`Username,${escapeCSV(summary.message.username)}`);
  lines.push(`Message Text,${escapeCSV(summary.message.text)}`);
  lines.push(`Created At,${escapeCSV(summary.message.created_at)}`);
  lines.push(`Emoji Sentiment,${escapeCSV(summary.emojiSentiment.toFixed(2))}`);
  lines.push(`Reply Sentiment,${escapeCSV(summary.replySentiment.toFixed(2))}`);
  lines.push(`Combined Sentiment,${escapeCSV(summary.combinedSentiment.toFixed(2))}`);
  if (summary.mood) {
    lines.push(`Mood,${escapeCSV(summary.mood.label)}`);
  }
  lines.push(`Total Replies,${escapeCSV(summary.totalReplies)}`);
  lines.push('');
  
  // Reactions
  lines.push('=== REACTIONS ===');
  lines.push('Emoji,Count,User IDs,Usernames');
  if (summary.reactions && summary.reactions.length > 0) {
    summary.reactions.forEach((reaction) => {
      const userIds = reaction.users.map((u) => u.id).join('; ');
      const usernames = reaction.users.map((u) => u.username).join('; ');
      lines.push(
        `${escapeCSV(reaction.emoji)},${escapeCSV(reaction.count)},${escapeCSV(userIds)},${escapeCSV(usernames)}`
      );
    });
  } else {
    lines.push('No reactions');
  }
  lines.push('');
  
  // Replies
  lines.push('=== REPLIES ===');
  lines.push('Reply Timestamp,User ID,Username,Text,Sentiment Score,Sentiment Label,Created At');
  if (summary.replies && summary.replies.length > 0) {
    summary.replies.forEach((reply) => {
      lines.push(
        `${escapeCSV(reply.reply_ts)},${escapeCSV(reply.user_id)},${escapeCSV(reply.username)},${escapeCSV(reply.text)},${escapeCSV(reply.sentiment_score)},${escapeCSV(reply.sentiment_label)},${escapeCSV(reply.created_at)}`
      );
    });
  } else {
    lines.push('No replies');
  }
  
  return lines.join('\n');
}

module.exports = { generateCSV };

