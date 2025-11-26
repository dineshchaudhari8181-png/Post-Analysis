const { WebClient } = require('@slack/web-api');
const config = require('../config');

const client = new WebClient(config.slack.botToken);

const userCache = new Map();
const channelCache = new Map();

async function fetchUser(userId) {
  if (userCache.has(userId)) return userCache.get(userId);
  const response = await client.users.info({ user: userId });
  const profile = {
    id: response.user?.id,
    username: response.user?.name,
    displayName: response.user?.profile?.display_name || response.user?.real_name,
  };
  userCache.set(userId, profile);
  return profile;
}

async function fetchChannel(channelId) {
  if (channelCache.has(channelId)) return channelCache.get(channelId);
  const response = await client.conversations.info({ channel: channelId });
  const channel = {
    id: response.channel?.id,
    name: response.channel?.name,
  };
  channelCache.set(channelId, channel);
  return channel;
}

module.exports = {
  client,
  fetchUser,
  fetchChannel,
};


