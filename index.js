const mineflayer = require('mineflayer');
const { Movements, pathfinder, goals: { GoalBlock } } = require('mineflayer-pathfinder');
const mcDataLoader = require('minecraft-data');
const express = require('express');
const {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  Events,
  SlashCommandBuilder
} = require('discord.js');

const config = require('./settings.json');
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;

// Web server for Render
const app = express();
app.get('/', (req, res) => res.send('Bot is alive'));
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Web server running on port ${PORT}`));

// Minecraft bot
let bot;
function createBot() {
  bot = mineflayer.createBot({
    host: config.server.ip,
    port: config.server.port,
    username: config['bot-account'].username,
    password: config['bot-account'].password,
    auth: config['bot-account'].type,
    version: config.server.version
  });

  bot.loadPlugin(pathfinder);
  const mcData = mcDataLoader(bot.version);
  const defaultMove = new Movements(bot, mcData);

  bot.once('spawn', () => {
    console.log('[Minecraft] Bot spawned');

    if (bot.settings && 'colorsEnabled' in bot.settings) {
      bot.settings.colorsEnabled = false;
    }

    if (config.utils['anti-afk'].enabled) {
      bot.setControlState('jump', true);
      if (config.utils['anti-afk'].sneak) {
        bot.setControlState('sneak', true);
      }
    }

    if (config.utils['chat-messages'].enabled) {
      const messages = config.utils['chat-messages'].messages;
      if (config.utils['chat-messages'].repeat) {
        let i = 0;
        setInterval(() => {
          bot.chat(messages[i]);
          i = (i + 1) % messages.length;
        }, config.utils['chat-messages']['repeat-delay'] * 1000);
      } else {
        messages.forEach(msg => bot.chat(msg));
      }
    }

    if (config.position.enabled) {
      bot.pathfinder.setMovements(defaultMove);
      bot.pathfinder.setGoal(new GoalBlock(config.position.x, config.position.y, config.position.z));
    }
  });

  bot.on('chat', (username, message) => {
    if (username === bot.username) return;
    const channel = client.channels.cache.get(DISCORD_CHANNEL_ID);
    if (channel) {
      channel.send(`🟩 ${username}: ${message}`).catch(console.error);
    }
  });

  bot.on('kicked', reason => console.log('[Minecraft] Kicked:', reason));
  bot.on('error', err => console.log('[Minecraft] Error:', err));

  if (config.utils['auto-reconnect']) {
    bot.on('end', () => {
      setTimeout(() => createBot(), config.utils['auto-recconect-delay']);
    });
  }
}
createBot();

// Discord bot
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

client.once(Events.ClientReady, () => {
  console.log(`[Discord] Logged in as ${client.user.tag}`);
});

client.on(Events.MessageCreate, msg => {
  if (msg.channel.id === DISCORD_CHANNEL_ID && !msg.author.bot && bot?.chat) {
    bot.chat(`[${msg.author.username}] ${msg.content}`);
  }
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  if (commandName === 'ping') {
    const sent = await interaction.reply({ content: '🏓 Pinging...', fetchReply: true });
    const roundTrip = sent.createdTimestamp - interaction.createdTimestamp;
    const wsPing = Math.round(client.ws.ping);
    await interaction.editReply(`🏓 Pong!\n⏱️ Round-trip: ${roundTrip}ms\n📡 WS Ping: ${wsPing}ms`);
  } else if (commandName === 'status') {
    const status = bot && bot.player ? `🟢 Connected as ${bot.username}` : '🔴 Not connected';
    await interaction.reply(status);
  } else if (commandName === 'say') {
    const msg = interaction.options.getString('message');
    if (bot && bot.chat) {
      bot.chat(msg);
      await interaction.reply(`✅ Sent to Minecraft: ${msg}`);
    } else {
      await interaction.reply('❌ Minecraft bot not connected');
    }
  } else if (commandName === 'coords') {
    if (bot && bot.entity) {
      const pos = bot.entity.position;
      await interaction.reply(`📍 Bot position: X=${pos.x.toFixed(2)}, Y=${pos.y.toFixed(2)}, Z=${pos.z.toFixed(2)}`);
    } else {
      await interaction.reply('❌ Bot not connected.');
    }
  } else if (commandName === 'restart') {
    await interaction.reply('♻️ Restarting the Minecraft bot...');
    if (bot) bot.end();
    setTimeout(() => createBot(), 1000);
  }
});

async function registerCommands() {
  const commands = [
    new SlashCommandBuilder().setName('ping').setDescription('Show Discord bot latency'),
    new SlashCommandBuilder().setName('status').setDescription('Check if the Minecraft bot is connected'),
    new SlashCommandBuilder().setName('say').setDescription('Send a message into Minecraft chat')
      .addStringOption(option =>
        option.setName('message').setDescription('The message to send').setRequired(true)),
    new SlashCommandBuilder().setName('coords').setDescription('Get Minecraft bot coordinates'),
    new SlashCommandBuilder().setName('restart').setDescription('Restart the Minecraft bot')
  ].map(cmd => cmd.toJSON());

  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
  try {
    const appId = (await client.application.fetch()).id;
    await rest.put(Routes.applicationCommands(appId), { body: commands });
    console.log('[Discord] Slash commands registered.');
  } catch (err) {
    console.error('[Discord] Failed to register commands:', err);
  }
}

client.login(DISCORD_TOKEN).then(registerCommands);
