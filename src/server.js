require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { createEventAdapter } = require('@slack/events-api');
const config = require('./config');
const { client, fetchUser, fetchChannel } = require('./services/slackClient');
const messageRepository = require('./services/messageRepository');
const { analyzeReply } = require('./services/sentiment');
const { buildSummaryModal } = require('./services/slackModal');

const slackEvents = createEventAdapter(config.slack.signingSecret);
const app = express();

app.use('/slack/events', slackEvents.expressMiddleware());

app.use(bodyParser.json());
app.use(
  bodyParser.urlencoded({
    extended: true,
  }),
);

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.post('/slack/interactions', bodyParser.urlencoded({ extended: true }), async (req, res) => {
  try {
    const payload = JSON.parse(req.body.payload);
    console.log('Received interaction', {
      type: payload.type,
      callback_id: payload.callback_id,
    });

    if (payload.type === 'message_action' && payload.callback_id === 'post_analysis_shortcut') {
      const channelId = payload.channel?.id;
      const messageTs = payload.message?.ts;
      console.log('Post Analysis shortcut invoked', { channelId, messageTs });

      await ensureMessageRecord(channelId, messageTs, payload.message?.text, payload.message?.user);
      const summary = await messageRepository.getMessageSummary(channelId, messageTs);
      if (!summary) {
        console.warn('No summary found for message', { channelId, messageTs });
        res.status(200).send();
        return;
      }
      await client.views.open({
        trigger_id: payload.trigger_id,
        view: buildSummaryModal(summary),
      });
    }
    res.status(200).send();
  } catch (error) {
    console.error('Interaction error', error);
    res.status(500).send();
  }
});

slackEvents.on('message', async (event) => {
  try {
    if (event.subtype && event.subtype !== 'thread_broadcast') return;
    if (!event.user || !event.channel) return;

    console.log('Slack message event', {
      ts: event.ts,
      thread_ts: event.thread_ts,
      channel: event.channel,
      user: event.user,
    });

    const [channel, user] = await Promise.all([
      fetchChannel(event.channel),
      fetchUser(event.user),
    ]);

    if (!event.thread_ts || event.thread_ts === event.ts) {
      await messageRepository.saveMessage({
        slackTs: event.ts,
        channel,
        user,
        text: event.text || '',
      });
    } else {
      await ensureMessageRecord(event.channel, event.thread_ts);
      const replySentiment = analyzeReply(event.text || '');
      await messageRepository.saveReply({
        messageTs: event.thread_ts,
        replyTs: event.ts,
        user,
        text: event.text || '',
        sentimentScore: replySentiment.score,
        sentimentLabel: replySentiment.label,
      });
    }

    await messageRepository.recalculateSentiment(event.thread_ts || event.ts);
  } catch (error) {
    console.error('Message event error', error);
  }
});

slackEvents.on('reaction_added', async (event) => {
  try {
    const channelId = event.item?.channel;
    const messageTs = event.item?.ts;
    if (!channelId || !messageTs) return;
    const user = await fetchUser(event.user);
    await ensureMessageRecord(channelId, messageTs);
    await messageRepository.addReaction({
      messageTs,
      emoji: event.reaction,
      user,
      reactionTs: event.event_ts,
    });
    await messageRepository.recalculateSentiment(messageTs);
  } catch (error) {
    console.error('Reaction added error', error);
  }
});

slackEvents.on('reaction_removed', async (event) => {
  try {
    const channelId = event.item?.channel;
    const messageTs = event.item?.ts;
    if (!channelId || !messageTs) return;
    await messageRepository.removeReaction({
      messageTs,
      emoji: event.reaction,
      userId: event.user,
    });
    await messageRepository.recalculateSentiment(messageTs);
  } catch (error) {
    console.error('Reaction removed error', error);
  }
});

slackEvents.on('error', (error) => {
  console.error('Slack events error', error);
});

async function ensureMessageRecord(channelId, messageTs, fallbackText = '', fallbackUser) {
  if (!channelId || !messageTs) return null;
  const existing = await messageRepository.getMessageByTs(messageTs);
  if (existing) return existing;

  const history = await client.conversations.history({
    channel: channelId,
    latest: messageTs,
    inclusive: true,
    limit: 1,
  });
  const slackMessage = history.messages?.[0];
  if (!slackMessage) return null;

  const [channel, user] = await Promise.all([
    fetchChannel(channelId),
    fetchUser(slackMessage.user || fallbackUser),
  ]);

  return messageRepository.saveMessage({
    slackTs: slackMessage.ts || messageTs,
    channel,
    user,
    text: slackMessage.text || fallbackText || '',
  });
}

const server = app.listen(config.app.port, () => {
  console.log(`Post Analysis API listening on port ${config.app.port}`);
});

process.on('SIGTERM', () => {
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});


