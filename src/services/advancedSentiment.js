const Sentiment = require('sentiment');
const emojiSentimentDataset = require('emoji-sentiment');
const emoji = require('node-emoji');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config');
const { client } = require('./slackClient');

const sentimentEngine = new Sentiment();

const emojiScoreMap = new Map(
  emojiSentimentDataset.map((entry) => {
    const codePoints = entry.sequence.split('-').map((value) => parseInt(value, 16));
    const emojiChar = String.fromCodePoint(...codePoints);
    return [emojiChar, entry.score];
  }),
);

const REACTION_ALIAS = {
  thumbsup: '👍',
  thumbsdown: '👎',
  '+1': '👍',
  '-1': '👎',
};

function getEmojiCharacterFromReaction(name = '') {
  if (!name) return null;
  const normalized = name.toLowerCase();
  const baseName = normalized.split('::')[0];
  return emoji.get(baseName) || REACTION_ALIAS[baseName] || null;
}

function getReactionSentimentDelta(name, count = 0) {
  const emojiChar = getEmojiCharacterFromReaction(name);
  if (!emojiChar) return 0;
  const score = emojiScoreMap.get(emojiChar);
  if (typeof score !== 'number') return 0;
  return score * count;
}

function trimText(text = '', max = 120) {
  const normalized = text.trim();
  return normalized.length <= max ? normalized : `${normalized.slice(0, max - 3)}...`;
}

function classifyMood(score) {
  if (score >= 3) return { label: 'Positive', emoji: '😄' };
  if (score <= -3) return { label: 'Negative', emoji: '😟' };
  return { label: 'Neutral', emoji: '😐' };
}

function summarizeReactions(reactions = []) {
  if (!Array.isArray(reactions) || reactions.length === 0) {
    return { reactionScore: 0, summaryText: 'No reactions yet.' };
  }

  let reactionScore = 0;
  const summaryParts = reactions.slice(0, 8).map((reaction) => {
    const name = reaction.name || 'reaction';
    const count = reaction.count || 0;
    reactionScore += getReactionSentimentDelta(name, count);
    return `:${name}: ×${count}`;
  });

  return { reactionScore, summaryText: summaryParts.join(' • ') };
}

let geminiClient = null;

if (config.google.apiKey) {
  try {
    geminiClient = new GoogleGenerativeAI(config.google.apiKey);
  } catch (error) {
    console.warn('Gemini initialization failed:', error.message);
  }
}

async function analyzeWithGemini(text, context = '', modelName) {
  if (!geminiClient) return 0;

  try {
    const model = geminiClient.getGenerativeModel({ model: modelName });
    const prompt = `Analyze the sentiment of this message and return ONLY a number from -3 to +3:

- +3 = Very positive
- +2 = Positive
- +1 = Slightly positive
- 0 = Neutral
- -1 = Slightly negative
- -2 = Negative
- -3 = Very negative

${context ? `Context:\n${context}\n\n` : ''}Message: "${text}"

Return ONLY the number, nothing else.`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const geminiText = response.text().trim();
    const score = parseFloat(geminiText);
    if (Number.isNaN(score)) {
      console.warn(`Gemini returned non-numeric value "${geminiText}"`);
      return 0;
    }
    return Math.max(-3, Math.min(3, score));
  } catch (error) {
    console.warn(`Gemini model "${modelName}" failed: ${error.message}`);
    return 0;
  }
}

async function analyzeThreadSentiment(messages = [], reactions = []) {
  const messageAnalyses = [];
  let textScore = 0;

  const context = messages
    .map((m) => m?.text?.trim())
    .filter(Boolean)
    .join(' ')
    .slice(0, 500);

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    const text = message?.text?.trim();
    if (!text) continue;

    const result = sentimentEngine.analyze(text);
    let finalScore = result.score;

    if (finalScore === 0 && geminiClient) {
      const modelsToTry = [
        config.google.model,
        'gemini-2.5-flash',
        'gemini-1.5-flash',
        'gemini-1.5-pro',
        'gemini-pro',
      ].filter((model, idx, arr) => model && arr.indexOf(model) === idx);

      // eslint-disable-next-line no-restricted-syntax
      for (const modelName of modelsToTry) {
        // eslint-disable-next-line no-await-in-loop
        const geminiScore = await analyzeWithGemini(text, context, modelName);
        if (geminiScore !== 0) {
          finalScore = geminiScore;
          break;
        }
      }
    }

    textScore += finalScore;

    messageAnalyses.push({
      ts: message.ts,
      text,
      snippet: trimText(text, 120),
      score: finalScore,
      userId: message.user,
      isRoot: message.thread_ts ? message.ts === message.thread_ts : false,
    });
  }

  const { reactionScore, summaryText } = summarizeReactions(reactions);
  const combinedScore = textScore + reactionScore;
  const mood = classifyMood(combinedScore);

  return {
    textScore,
    reactionScore,
    combinedScore,
    mood,
    reactionSummaryText: summaryText,
    messageAnalyses,
    analyzedMessageCount: messageAnalyses.length,
  };
}

async function fetchThreadMessages(channelId, rootTs) {
  const response = await client.conversations.replies({
    channel: channelId,
    ts: rootTs,
    inclusive: true,
    limit: 50,
  });
  return response.messages || [];
}

async function fetchRootReactions(channelId, rootTs) {
  try {
    const response = await client.reactions.get({
      channel: channelId,
      timestamp: rootTs,
      full: true,
    });
    return response?.message?.reactions || [];
  } catch (error) {
    console.warn('Unable to fetch reactions for advanced sentiment:', error.message);
    return [];
  }
}

async function analyzeThreadForMessage(channelId, rootTs) {
  const [messages, reactions] = await Promise.all([
    fetchThreadMessages(channelId, rootTs),
    fetchRootReactions(channelId, rootTs),
  ]);
  if (!messages.length) {
    throw new Error('Unable to read conversation messages (is the bot in the channel?)');
  }
  return analyzeThreadSentiment(messages, reactions);
}

module.exports = {
  analyzeThreadForMessage,
};


