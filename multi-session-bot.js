import { MultiSessionBotManager } from './utils/multi-session-manager.js';

console.log('🚀 Starting Multi-Session WhatsApp Bot...');
console.log('================================');

const botManager = new MultiSessionBotManager();

// Make bot manager globally available
global.botManager = botManager;

// Start all enabled sessions
botManager.initializeAllSessions().catch(error => {
    console.error('❌ Failed to start bot manager:', error);
    process.exit(1);
});

// Handle process termination
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down bot...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Bot terminated');
    process.exit(0);
});