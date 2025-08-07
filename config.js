require('dotenv').config();

const config = {
    // Discord Configuration
    DISCORD_TOKEN: process.env.DISCORD_TOKEN || '',
    DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID || '',
    DISCORD_CHANNEL_ID: process.env.DISCORD_CHANNEL_ID || '',
    
    // Minecraft Configuration
    MINECRAFT_HOST: process.env.MINECRAFT_HOST || 'LifeSteal029.aternos.me',
    MINECRAFT_PORT: parseInt(process.env.MINECRAFT_PORT) || 48688,
    MINECRAFT_USERNAME: process.env.MINECRAFT_USERNAME || 'AIBot_LS029',
    
    // AI Configuration
    TOGETHER_API_KEY: process.env.TOGETHER_API_KEY || '',
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || '',
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
    
    // Bot Behavior Configuration
    AI_RESPONSE_CHANCE: parseFloat(process.env.AI_RESPONSE_CHANCE) || 0.3,
    AUTO_RESPAWN: process.env.AUTO_RESPAWN !== 'false',
    AUTO_EAT: process.env.AUTO_EAT !== 'false',
    COMMAND_PREFIX: process.env.COMMAND_PREFIX || '!',
    
    // Reconnection Settings
    RECONNECT_DELAY: parseInt(process.env.RECONNECT_DELAY) || 5000,
    MAX_RECONNECT_ATTEMPTS: parseInt(process.env.MAX_RECONNECT_ATTEMPTS) || 10,
    
    // Rate Limiting
    CHAT_COOLDOWN: parseInt(process.env.CHAT_COOLDOWN) || 2000,
    
    // Development Settings
    DEBUG_MODE: process.env.DEBUG_MODE === 'true',
    LOG_LEVEL: process.env.LOG_LEVEL || 'info'
};

// Validation - Only check required fields if not in test environment
const requiredFields = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID', 'TOGETHER_API_KEY'];
const missingFields = requiredFields.filter(field => !config[field]);

if (missingFields.length > 0 && process.env.NODE_ENV !== 'test') {
    console.error('Missing required environment variables:', missingFields.join(', '));
    console.error('Please check your .env file or environment variables');
    
    // Don't exit in production deployment, just warn
    if (process.env.NODE_ENV === 'production') {
        console.warn('Starting with missing environment variables - some features may not work');
    } else {
        process.exit(1);
    }
}

module.exports = config;
