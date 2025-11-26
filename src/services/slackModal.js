function formatUsers(reactions) {
  return reactions
    .map((reaction) => {
      const userList = reaction.users
        .map((user) => `<@${user.id}>`)
        .join(', ');
      return `:${reaction.emoji}: (${reaction.count}) – ${userList}`;
    })
    .join('\n');
}

function buildSummaryModal(summary) {
  const moodText = summary.mood
    ? `${summary.mood.emoji} ${summary.mood.label}`
    : 'N/A';
  const reactionsBlock = summary.reactions.length
    ? formatUsers(summary.reactions)
    : 'No reactions yet.';
  const repliesBlock = summary.replies.length
    ? summary.replies
        .map((reply) => `• <@${reply.user_id}>: ${reply.text || '_no text_'} (${reply.sentiment_label})`)
        .join('\n')
    : 'No replies yet.';

  return {
    type: 'modal',
    callback_id: 'post_analysis_modal',
    title: { type: 'plain_text', text: 'Post Analysis', emoji: true },
    close: { type: 'plain_text', text: 'Close', emoji: true },
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Channel:* <#${summary.message.channel_id}>`,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `*Original Message:* ${summary.message.text || '_no text_'}`,
          },
        ],
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Emoji Sentiment*\n${summary.emojiSentiment.toFixed(2)}` },
          { type: 'mrkdwn', text: `*Reply Sentiment*\n${summary.replySentiment.toFixed(2)}` },
          { type: 'mrkdwn', text: `*Combined*\n${summary.combinedSentiment.toFixed(2)}` },
          { type: 'mrkdwn', text: `*Mood*\n${moodText}` },
          { type: 'mrkdwn', text: `*Total Replies*\n${summary.totalReplies}` },
        ],
      },
      {
        type: 'header',
        text: { type: 'plain_text', text: 'Reactions', emoji: true },
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: reactionsBlock },
      },
      {
        type: 'header',
        text: { type: 'plain_text', text: 'Replies', emoji: true },
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: repliesBlock },
      },
    ],
  };
}

module.exports = { buildSummaryModal };


