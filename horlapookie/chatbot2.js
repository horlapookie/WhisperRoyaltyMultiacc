import axios from 'axios';

export const command = {
    name: 'chatbot2',
    aliases: ['cb2', 'deepai2'],
    category: 'AI',
    description: 'Advanced AI chatbot using DeepAI (Note: Requires API credits)',
    usage: 'chatbot2 <message>',
    ownerOnly: true,

    async execute(sock, msg, args, context) {
        const { from, sender, settings, isOwner, botState } = context;

        if (!isOwner) {
            await sock.sendMessage(from, { text: '❌ This command is only for bot owners.' });
            return;
        }

        if (!args.trim()) {
            await sock.sendMessage(from, {
                text: `🤖 **DeepSeek Chatbot 2 Control**

**Commands:**
• .chatbot2 on - Enable chatbot for DMs
• .chatbot2 off - Disable chatbot
• .chatbot2 girl - Enable with feminine personality
• .chatbot2 boy - Enable with masculine personality
• .chatbot2 clear - Clear all conversation memories
• .chatbot2 stats - Show usage statistics

**Current Status:** ${global.chatbot2Enabled ? '🟢 ENABLED' : '🔴 DISABLED'}
**Personality:** ${global.chatbot2Personality || 'default'}`,
                contextInfo: {
                    externalAdReply: {
                        title: 'Chatbot 2 Control Panel',
                        body: 'DeepSeek AI Chatbot',
                        thumbnailUrl: settings.profilePics[Math.floor(Math.random() * settings.profilePics.length)],
                        sourceUrl: 'https://github.com',
                        mediaType: 1
                    }
                }
            });
            return;
        }

        const command = args.trim().toLowerCase();

        // Initialize global chatbot2 state
        if (typeof global.chatbot2Enabled === 'undefined') {
            global.chatbot2Enabled = false;
            global.chatbot2Personality = 'default';
            global.chatbot2Memory = new Map();
        }

        switch (command) {
            case 'on':
                global.chatbot2Enabled = true;
                global.chatbot2Personality = 'default';
                await sock.sendMessage(from, {
                    text: '🤖 **Chatbot 2 Activated**\n\nDeepSeek AI chatbot is now responding to DMs with default personality.',
                    contextInfo: {
                        externalAdReply: {
                            title: 'Chatbot 2 ON',
                            body: 'DeepSeek AI activated',
                            thumbnailUrl: settings.profilePics[Math.floor(Math.random() * settings.profilePics.length)],
                            sourceUrl: 'https://github.com',
                            mediaType: 1
                        }
                    }
                });
                break;

            case 'off':
                global.chatbot2Enabled = false;
                await sock.sendMessage(from, {
                    text: '🤖 **Chatbot 2 Deactivated**\n\nDeepSeek AI chatbot has been disabled.',
                    contextInfo: {
                        externalAdReply: {
                            title: 'Chatbot 2 OFF',
                            body: 'DeepSeek AI deactivated',
                            thumbnailUrl: settings.profilePics[Math.floor(Math.random() * settings.profilePics.length)],
                            sourceUrl: 'https://github.com',
                            mediaType: 1
                        }
                    }
                });
                break;

            case 'girl':
            case 'lady':
                global.chatbot2Enabled = true;
                global.chatbot2Personality = 'girl';
                await sock.sendMessage(from, {
                    text: '👩 **Chatbot 2 - Girl Mode**\n\nDeepSeek AI is now responding with a sweet, caring feminine personality! 💕',
                    contextInfo: {
                        externalAdReply: {
                            title: 'Chatbot 2 - Girl Mode',
                            body: 'Feminine AI personality',
                            thumbnailUrl: settings.profilePics[Math.floor(Math.random() * settings.profilePics.length)],
                            sourceUrl: 'https://github.com',
                            mediaType: 1
                        }
                    }
                });
                break;

            case 'boy':
            case 'man':
                global.chatbot2Enabled = true;
                global.chatbot2Personality = 'boy';
                await sock.sendMessage(from, {
                    text: '👨 **Chatbot 2 - Boy Mode**\n\nDeepSeek AI is now responding with a cool, confident masculine personality! 😎',
                    contextInfo: {
                        externalAdReply: {
                            title: 'Chatbot 2 - Boy Mode',
                            body: 'Masculine AI personality',
                            thumbnailUrl: settings.profilePics[Math.floor(Math.random() * settings.profilePics.length)],
                            sourceUrl: 'https://github.com',
                            mediaType: 1
                        }
                    }
                });
                break;

            case 'clear':
                global.chatbot2Memory.clear();
                await sock.sendMessage(from, {
                    text: '🧹 **All Memories Cleared**\n\nChatbot 2 conversation history has been reset for all users.',
                    contextInfo: {
                        externalAdReply: {
                            title: 'Memory Cleared',
                            body: 'All conversations reset',
                            thumbnailUrl: settings.profilePics[Math.floor(Math.random() * settings.profilePics.length)],
                            sourceUrl: 'https://github.com',
                            mediaType: 1
                        }
                    }
                });
                break;

            case 'stats':
                const totalUsers = global.chatbot2Memory.size;
                const totalMessages = Array.from(global.chatbot2Memory.values())
                    .reduce((sum, memory) => sum + memory.history.length, 0);

                await sock.sendMessage(from, {
                    text: `📊 **Chatbot 2 Statistics**

🤖 **Status:** ${global.chatbot2Enabled ? '🟢 ACTIVE' : '🔴 INACTIVE'}
👤 **Personality:** ${global.chatbot2Personality || 'default'}
👥 **Active Users:** ${totalUsers}
💬 **Total Messages:** ${totalMessages}
🧠 **Memory Duration:** Persistent`,
                    contextInfo: {
                        externalAdReply: {
                            title: 'Chatbot 2 Statistics',
                            body: 'Usage analytics',
                            thumbnailUrl: settings.profilePics[Math.floor(Math.random() * settings.profilePics.length)],
                            sourceUrl: 'https://github.com',
                            mediaType: 1
                        }
                    }
                });
                break;

            default:
                await sock.sendMessage(from, {
                    text: '❓ **Invalid Command**\n\nUse: chatbot2 on/off/girl/boy/clear/stats'
                });
                break;
        }
    }
};

// Function to handle chatbot2 responses (to be called from message handler)
export async function handleChatbot2Response(sock, msg, messageText, context) {
    const { from, sender, settings, isOwner, isGroup } = context;

    // Only respond in DMs and if chatbot2 is enabled
    if (isGroup || !global.chatbot2Enabled || isOwner) {
        return false;
    }

    // Initialize memory if not exists
    if (!global.chatbot2Memory) {
        global.chatbot2Memory = new Map();
    }

    if (!global.chatbot2Memory.has(sender)) {
        global.chatbot2Memory.set(sender, {
            history: [],
            lastInteraction: Date.now()
        });
    }

    const userMemory = global.chatbot2Memory.get(sender);
    const personality = global.chatbot2Personality || 'default';

    // Add user message to history
    userMemory.history.push({
        role: 'user',
        content: messageText,
        timestamp: Date.now()
    });

    // Keep only last 15 messages
    if (userMemory.history.length > 15) {
        userMemory.history = userMemory.history.slice(-15);
    }

    try {
        // Send typing indicator
        await sock.sendPresenceUpdate('composing', from);

        // Create personality-based system prompt
        let systemPrompt = '';
        switch (personality) {
            case 'girl':
                systemPrompt = 'You are a sweet, caring girl assistant. You speak in a feminine, gentle way with emojis. You\'re supportive, empathetic, and use expressions like "sweetie", "honey", or "dear" occasionally. Keep responses brief and warm.';
                break;
            case 'boy':
                systemPrompt = 'You are a cool, confident guy assistant. You speak in a masculine, casual way. You\'re direct, helpful, and use expressions like "bro", "dude", or "mate" occasionally. Keep responses brief and to the point.';
                break;
            default:
                systemPrompt = 'You are a helpful AI assistant. Keep responses brief, informative, and engaging.';
                break;
        }

        const response = await axios.post('https://api.deepai.org/api/text-generator', {
            text: systemPrompt + '\n\n' + userMemory.history.map(h => `${h.role}: ${h.content}`).join('\n') + '\nassistant:'
        }, {
            headers: {
                'api-key': settings.deepaiApiKey,
                'Content-Type': 'application/json'
            },
            timeout: 30000
        });

        const reply = response.data.output;

        // Add AI response to history
        userMemory.history.push({
            role: 'assistant',
            content: reply,
            timestamp: Date.now()
        });

        await sock.sendMessage(from, {
            text: reply,
            contextInfo: {
                externalAdReply: {
                    title: 'DeepSeek Chatbot 2',
                    body: 'AI Assistant',
                    thumbnailUrl: settings.profilePics[Math.floor(Math.random() * settings.profilePics.length)],
                    sourceUrl: 'https://github.com',
                    mediaType: 1,
                    renderLargerThumbnail: false
                }
            }
        });

        return true; // Indicate that we handled the message

    } catch (error) {
            console.error('Chatbot2 Error:', error);

            // Check for specific API credit error
            if (error.response?.data?.status?.includes('Out of API credits')) {
                await sock.sendMessage(from, {
                    text: '❌ DeepAI API credits exhausted. Please check the dashboard: https://deepai.org/dashboard',
                    contextInfo: {
                        externalAdReply: {
                            title: 'API Credits Exhausted',
                            body: 'DeepAI requires payment',
                            thumbnailUrl: 'https://files.catbox.moe/mq8b1n.png',
                            sourceUrl: 'https://deepai.org/dashboard',
                            mediaType: 1,
                            renderLargerThumbnail: false
                        }
                    }
                });
                return;
            }

            await sock.sendMessage(from, {
                text: '❌ Failed to get response from AI. Please try again later.',
    } finally {
        // Stop typing indicator
        try {
            await sock.sendPresenceUpdate('paused', from);
        } catch (error) {
            console.error('Error stopping typing indicator:', error);
        }
    }
}