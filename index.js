const mineflayer = require('mineflayer');
const { Movements, pathfinder, goals: { GoalBlock } } = require('mineflayer-pathfinder');
const mcDataLoader = require('minecraft-data');
const express = require('express');
const { Client, GatewayIntentBits, Partials, REST, Routes, Events, SlashCommandBuilder } = require('discord.js');

const config = require('./settings.json');
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;

// --- Web server for Render keep-alive ---
const app = express();
app.get('/', (req, res) => res.send('Bot is alive'));
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Web server running on port ${PORT}`));

// --- Minecraft Bot ---
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
    console.log('[AFKBot] Minecraft bot joined the server');

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

  bot.on('kicked', reason => console.log('[AFKBot] Kicked:', reason));
  bot.on('error', err => console.log('[AFKBot] Error:', err));
  if (config.utils['auto-reconnect']) {
    bot.on('end', () => {
      setTimeout(() => createBot(), config.utils['auto-recconect-delay']);
    });
  }
}

createBot();

// --- Discord Bot ---
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
    bot.chat(`[Discord] ${msg.author.username}: ${msg.content}`);
  }
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'ping') {
    await interaction.reply('🏓 Pong!');
  }
});

async function registerCommands() {
  const commands = [
    new SlashCommandBuilder().setName('ping').setDescription('Replies with Pong!')
  ].map(cmd => cmd.toJSON());

  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
  try {
    console.log('[Discord] Registering slash commands...');
    const appId = (await client.application.fetch()).id;
    await rest.put(Routes.applicationCommands(appId), { body: commands });
    console.log('[Discord] Slash commands registered.');
  } catch (err) {
    console.error('[Discord] Error registering slash commands:', err);
  }
}

client.login(DISCORD_TOKEN).then(registerCommands);
