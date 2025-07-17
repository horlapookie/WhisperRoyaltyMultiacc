import axios from 'axios';

export const command = {
    name: 'deepseek',
    aliases: ['ds', 'deepai'],
    category: 'AI',
    description: 'Chat with DeepAI (Note: Requires API credits)',
    usage: 'deepseek <message>',
    cooldown: 3,

    async execute(sock, msg, args, context) {
        const { from, sender, settings, isOwner } = context;

        if (!args.trim()) {
            await sock.sendMessage(from, {
                text: `🤖 **DeepSeek AI Assistant**

**Usage:**
• .deepseek <your message> - Chat with AI
• .deepseek clear - Clear conversation history
• .deepseek history - View conversation log
• .deepseek image <prompt> - Generate image
• .deepseek analyze - Analyze quoted message/image

**Examples:**
• .deepseek What is quantum computing?
• .deepseek image A futuristic cityscape
• Reply to a message with .deepseek analyze`,
                contextInfo: {
                    externalAdReply: {
                        title: 'DeepSeek AI Assistant',
                        body: 'Advanced AI with memory',
                        thumbnailUrl: settings.profilePics[Math.floor(Math.random() * settings.profilePics.length)],
                        sourceUrl: 'https://github.com',
                        mediaType: 1,
                        renderLargerThumbnail: false
                    }
                }
            });
            return;
        }

        // Initialize conversation contexts
        if (!global.deepseekContexts) {
            global.deepseekContexts = {};
        }

        if (!global.deepseekContexts[sender]) {
            global.deepseekContexts[sender] = {
                history: [],
                lastInteraction: Date.now()
            };
        }

        const userContext = global.deepseekContexts[sender];
        const command = args.trim().split(' ')[0].toLowerCase();

        try {
            switch (command) {
                case 'clear':
                    if (isOwner) {
                        userContext.history = [];
                        await sock.sendMessage(from, {
                            text: '🧹 **DeepSeek Memory Cleared**\n\nYour conversation history has been reset.',
                            contextInfo: {
                                externalAdReply: {
                                    title: 'Memory Cleared',
                                    body: 'Fresh conversation started',
                                    thumbnailUrl: settings.profilePics[Math.floor(Math.random() * settings.profilePics.length)],
                                    sourceUrl: 'https://github.com',
                                    mediaType: 1
                                }
                            }
                        });
                    } else {
                        await sock.sendMessage(from, { text: '❌ Only owners can clear memory.' });
                    }
                    break;

                case 'history':
                    if (isOwner) {
                        const historyText = userContext.history.length > 0 
                            ? userContext.history.slice(-10).map((entry, index) => 
                                `${index + 1}. **${entry.role === 'user' ? 'You' : 'AI'}:** ${entry.content.substring(0, 50)}...`
                            ).join('\n')
                            : 'No conversation history yet.';

                        await sock.sendMessage(from, {
                            text: `📚 **DeepSeek Conversation History**\n\n${historyText}\n\n💡 Showing last 10 interactions`,
                            contextInfo: {
                                externalAdReply: {
                                    title: 'Conversation History',
                                    body: `${userContext.history.length} total interactions`,
                                    thumbnailUrl: settings.profilePics[Math.floor(Math.random() * settings.profilePics.length)],
                                    sourceUrl: 'https://github.com',
                                    mediaType: 1
                                }
                            }
                        });
                    } else {
                        await sock.sendMessage(from, { text: '❌ Only owners can view history.' });
                    }
                    break;

                case 'image':
                    const imagePrompt = args.slice(5).trim();
                    if (!imagePrompt) {
                        await sock.sendMessage(from, { text: '❌ Please provide a prompt for image generation.' });
                        return;
                    }
                    await generateDeepSeekImage(sock, from, imagePrompt, settings);
                    break;

                case 'analyze':
                    await analyzeQuotedContent(sock, msg, from, settings);
                    break;

                default:
                    await handleDeepSeekConversation(sock, from, sender, args, userContext, settings);
                    break;
            }
        } catch (error) {
            console.error('DeepAI Error:', error);

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
                text: '❌ Failed to get response from DeepAI. Please try again later.',
            });
        }
    }
};

async function handleDeepSeekConversation(sock, from, sender, message, userContext, settings) {
    // Add user message to context
    userContext.history.push({
        role: 'user',
        content: message,
        timestamp: Date.now()
    });

    // Keep only last 20 messages to prevent token overflow
    if (userContext.history.length > 20) {
        userContext.history = userContext.history.slice(-20);
    }

    try {
        const response = await axios.post('https://api.deepai.org/api/text-generator', {
            text: userContext.history.map(h => `${h.role}: ${h.content}`).join('\n') + '\nassistant:'
        }, {
            headers: {
                'api-key': settings.deepaiApiKey,
                'Content-Type': 'application/json'
            },
            timeout: 30000
        });

        const reply = response.data.output;

        // Add AI response to context
        userContext.history.push({
            role: 'assistant',
            content: reply,
            timestamp: Date.now()
        });

        await sock.sendMessage(from, {
            text: `🤖 **DeepSeek AI**\n\n${reply}`,
            contextInfo: {
                externalAdReply: {
                    title: 'DeepSeek AI',
                    body: 'Advanced AI Assistant',
                    thumbnailUrl: settings.profilePics[Math.floor(Math.random() * settings.profilePics.length)],
                    sourceUrl: 'https://github.com',
                    mediaType: 1,
                    renderLargerThumbnail: false
                }
            }
        });

    } catch (error) {
        console.error('DeepSeek API error:', error);
        await sock.sendMessage(from, {
            text: '❌ Failed to get response from DeepSeek AI. Please try again later.'
        });
    }
}

async function generateDeepSeekImage(sock, from, prompt, settings) {
    try {
        // Note: DeepSeek doesn't have image generation API yet
        // This is a placeholder for when they add it
        await sock.sendMessage(from, {
            text: '🎨 **Image Generation**\n\n⚠️ DeepSeek image generation is not available yet. Please use other AI image commands.',
            contextInfo: {
                externalAdReply: {
                    title: 'Image Generation',
                    body: 'Feature coming soon',
                    thumbnailUrl: settings.profilePics[Math.floor(Math.random() * settings.profilePics.length)],
                    sourceUrl: 'https://github.com',
                    mediaType: 1
                }
            }
        });
    } catch (error) {
        console.error('Image generation error:', error);
        await sock.sendMessage(from, { text: '❌ Image generation failed.' });
    }
}

async function analyzeQuotedContent(sock, msg, from, settings) {
    try {
        const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

        if (!quotedMsg) {
            await sock.sendMessage(from, { text: '❌ Please reply to a message to analyze it.' });
            return;
        }

        let analysisPrompt = '';

        if (quotedMsg.conversation || quotedMsg.extendedTextMessage?.text) {
            const text = quotedMsg.conversation || quotedMsg.extendedTextMessage?.text;
            analysisPrompt = `Analyze this text message: "${text}"`;
        } else if (quotedMsg.imageMessage) {
            analysisPrompt = 'This is an image message. Please describe what you can infer about images in general.';
        } else {
            analysisPrompt = 'Analyze this media message and provide insights.';
        }

        const response = await axios.post('https://api.deepai.org/api/text-generator', {
            text: `You are an expert analyst. Provide detailed analysis of the given content.\n\n${analysisPrompt}`
        }, {
            headers: {
                'api-key': settings.deepaiApiKey,
                'Content-Type': 'application/json'
            },
            timeout: 30000
        });

        const analysis = response.data.output;

        await sock.sendMessage(from, {
            text: `🔍 **DeepSeek Analysis**\n\n${analysis}`,
            contextInfo: {
                externalAdReply: {
                    title: 'Content Analysis',
                    body: 'AI-powered insights',
                    thumbnailUrl: settings.profilePics[Math.floor(Math.random() * settings.profilePics.length)],
                    sourceUrl: 'https://github.com',
                    mediaType: 1
                }
            }
        }, { quoted: msg });

    } catch (error) {
        console.error('Analysis error:', error);
        await sock.sendMessage(from, { text: '❌ Analysis failed. Please try again.' });
    }
}