const Sentiment = require('sentiment');
const emojiSentimentDataset = require('emoji-sentiment');
const emoji = require('node-emoji');

const sentimentAnalyzer = new Sentiment();
const emojiScoreLookup = emojiSentimentDataset.reduce((acc, entry) => {
  acc[entry.emoji] = entry.score;
  return acc;
}, {});

const emojiWeights = new Map();

function getEmojiScore(emojiName) {
  const symbol = emoji.get(emojiName);
  if (!symbol) return 0;

  const cached = emojiWeights.get(emojiName);
  if (typeof cached === 'number') {
    return cached;
  }

  const score = emojiScoreLookup[symbol] || 0;
  emojiWeights.set(emojiName, score);
  return score;
}

function computeEmojiSentiment(aggregatedReactions) {
  if (!aggregatedReactions.length) return 0;
  const totalScore = aggregatedReactions.reduce((acc, reaction) => {
    const multiplier = reaction.count || reaction.users?.length || 1;
    return acc + getEmojiScore(reaction.emoji) * multiplier;
  }, 0);

  const totalCount = aggregatedReactions.reduce((acc, reaction) => {
    return acc + (reaction.count || reaction.users?.length || 1);
  }, 0);

  return totalCount === 0 ? 0 : totalScore / totalCount;
}

function classifySentiment(score) {
  if (score > 0.1) return 'positive';
  if (score < -0.1) return 'negative';
  return 'neutral';
}

function analyzeReply(text) {
  const result = sentimentAnalyzer.analyze(text || '');
  const score = result.comparative;
  return {
    score,
    label: classifySentiment(score),
  };
}

function computeReplySentiment(replies) {
  if (!replies.length) return 0;
  const total = replies.reduce((acc, reply) => acc + (reply.sentiment_score || 0), 0);
  return total / replies.length;
}

function blendSentimentScores(emojiScore, replyScore) {
  const emojiWeight = 0.4;
  const replyWeight = 0.6;
  return (emojiScore * emojiWeight) + (replyScore * replyWeight);
}

module.exports = {
  computeEmojiSentiment,
  computeReplySentiment,
  classifySentiment,
  blendSentimentScores,
  analyzeReply,
};


