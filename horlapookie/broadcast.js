
import { settings } from '../settings.js';

export const command = {
    name: 'broadcast',
    aliases: ['bc', 'sendall'],
    description: 'Broadcast a message to all contacts (Owner only)',
    usage: 'broadcast <message> | broadcast (reply to message)',
    category: 'owner',
    cooldown: 30,
    
    async execute(sock, msg, args, context) {
        const { from, sender, isOwner, isCreator } = context;
        
        // Check if user is owner or creator
        if (!isOwner && !isCreator) {
            await sock.sendMessage(from, {
                text: '❌ **Access Denied**\n\n🔒 This command is restricted to bot owners only.',
                contextInfo: {
                    externalAdReply: {
                        title: 'Access Denied',
                        body: 'Owner command only',
                        thumbnailUrl: 'https://files.catbox.moe/mq8b1n.png',
                        sourceUrl: 'https://github.com',
                        mediaType: 1,
                        renderLargerThumbnail: false
                    }
                }
            });
            return;
        }

        let broadcastMessage = '';
        let mediaMessage = null;
        let excludeNumbers = [];

        // Parse args to extract exclude numbers
        const argsArray = args.trim().split(' ');
        let messageText = '';
        let excludeStartIndex = -1;

        // Find where exclude numbers start (look for phone numbers)
        for (let i = 0; i < argsArray.length; i++) {
            const arg = argsArray[i];
            // Check if it's a phone number (starts with + or is all digits, 10-15 chars)
            if ((arg.startsWith('+') && /^\+\d{10,15}$/.test(arg)) || 
                (/^\d{10,15}$/.test(arg))) {
                excludeStartIndex = i;
                break;
            }
        }

        if (excludeStartIndex !== -1) {
            // Extract message text (everything before phone numbers)
            messageText = argsArray.slice(0, excludeStartIndex).join(' ');
            
            // Extract phone numbers (up to 10)
            const phoneNumbers = argsArray.slice(excludeStartIndex, excludeStartIndex + 10);
            excludeNumbers = phoneNumbers.filter(num => {
                // Validate phone number format
                return (num.startsWith('+') && /^\+\d{10,15}$/.test(num)) || 
                       (/^\d{10,15}$/.test(num));
            }).map(num => {
                // Normalize phone numbers (remove + and ensure proper format)
                return num.startsWith('+') ? num.substring(1) : num;
            });
        } else {
            // No phone numbers found, treat entire args as message
            messageText = args.trim();
        }

        // Check if replying to a message
        const quotedMessage = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (quotedMessage) {
            // Get text from quoted message
            const quotedText = quotedMessage.conversation || 
                             quotedMessage.extendedTextMessage?.text || 
                             quotedMessage.imageMessage?.caption ||
                             quotedMessage.videoMessage?.caption ||
                             quotedMessage.documentMessage?.caption || '';
            
            if (quotedText) {
                broadcastMessage = quotedText;
                // If replying to message, use the args as exclude numbers
                if (args.trim()) {
                    const replyExcludeNumbers = args.trim().split(' ').filter(num => {
                        return (num.startsWith('+') && /^\+\d{10,15}$/.test(num)) || 
                               (/^\d{10,15}$/.test(num));
                    }).map(num => {
                        return num.startsWith('+') ? num.substring(1) : num;
                    });
                    excludeNumbers = replyExcludeNumbers.slice(0, 10); // Limit to 10
                }
            }

            // Check for media in quoted message
            if (quotedMessage.imageMessage) {
                mediaMessage = {
                    type: 'image',
                    message: quotedMessage.imageMessage
                };
            } else if (quotedMessage.videoMessage) {
                mediaMessage = {
                    type: 'video',
                    message: quotedMessage.videoMessage
                };
            } else if (quotedMessage.documentMessage) {
                mediaMessage = {
                    type: 'document',
                    message: quotedMessage.documentMessage
                };
            } else if (quotedMessage.audioMessage) {
                mediaMessage = {
                    type: 'audio',
                    message: quotedMessage.audioMessage
                };
            } else if (quotedMessage.stickerMessage) {
                mediaMessage = {
                    type: 'sticker',
                    message: quotedMessage.stickerMessage
                };
            }
        }

        // If no quoted message, use the messageText as broadcast message
        if (!broadcastMessage && messageText) {
            broadcastMessage = messageText;
        }

        // If still no message, show usage
        if (!broadcastMessage && !mediaMessage) {
            await sock.sendMessage(from, {
                text: `❓ **Broadcast Usage**\n\n📝 **Text Message:**\n${settings.prefix}broadcast <your message>\n\n📝 **With Exclusions:**\n${settings.prefix}broadcast <message> <phone1> <phone2> ...\n\n📱 **Reply Method:**\nReply to any message with ${settings.prefix}broadcast\n\n📱 **Reply with Exclusions:**\nReply to message with ${settings.prefix}broadcast <phone1> <phone2> ...\n\n📞 **Phone Format:** +1234567890 or 1234567890\n🔢 **Max Exclusions:** 10 numbers\n\n⚠️ **Warning:** This will send the message to ALL your WhatsApp contacts except excluded numbers!`,
                contextInfo: {
                    externalAdReply: {
                        title: 'Broadcast Usage',
                        body: 'How to use broadcast command',
                        thumbnailUrl: 'https://files.catbox.moe/mq8b1n.png',
                        sourceUrl: 'https://github.com',
                        mediaType: 1,
                        renderLargerThumbnail: false
                    }
                }
            });
            return;
        }

        try {
            // Confirmation message
            let confirmationText = `🔄 **Broadcast Starting...**\n\n📢 Message: ${broadcastMessage || 'Media message'}\n⏳ Getting contact list...`;
            
            if (excludeNumbers.length > 0) {
                confirmationText += `\n\n🚫 **Excluded Numbers:** ${excludeNumbers.length}\n${excludeNumbers.map(num => `• +${num}`).join('\n')}`;
            }
            
            await sock.sendMessage(from, {
                text: confirmationText,
                contextInfo: {
                    externalAdReply: {
                        title: 'Broadcast Started',
                        body: excludeNumbers.length > 0 ? `Sending to all contacts (excluding ${excludeNumbers.length})` : 'Sending to all contacts',
                        thumbnailUrl: 'https://files.catbox.moe/mq8b1n.png',
                        sourceUrl: 'https://github.com',
                        mediaType: 1,
                        renderLargerThumbnail: false
                    }
                }
            });

            // Get all contacts
            const contacts = await sock.store.contacts || {};
            let contactJids = Object.keys(contacts).filter(jid => 
                jid.endsWith('@s.whatsapp.net') && 
                jid !== sock.user.id && 
                !jid.includes('broadcast')
            );

            // Filter out excluded numbers
            if (excludeNumbers.length > 0) {
                contactJids = contactJids.filter(jid => {
                    const phoneNumber = jid.split('@')[0];
                    // Check if this contact's number is in the exclude list
                    return !excludeNumbers.some(excludeNum => {
                        // Compare both with and without country code
                        return phoneNumber === excludeNum || 
                               phoneNumber.endsWith(excludeNum) || 
                               excludeNum.endsWith(phoneNumber.substring(phoneNumber.length - 10));
                    });
                });
            }

            if (contactJids.length === 0) {
                await sock.sendMessage(from, {
                    text: '❌ **No Contacts Found**\n\nNo WhatsApp contacts available for broadcast.',
                    contextInfo: {
                        externalAdReply: {
                            title: 'Broadcast Failed',
                            body: 'No contacts available',
                            thumbnailUrl: 'https://files.catbox.moe/mq8b1n.png',
                            sourceUrl: 'https://github.com',
                            mediaType: 1,
                            renderLargerThumbnail: false
                        }
                    }
                });
                return;
            }

            let successCount = 0;
            let failCount = 0;

            // Send broadcast message to each contact
            for (const contactJid of contactJids) {
                try {
                    if (mediaMessage) {
                        // Send media message
                        const messageContent = {};
                        
                        if (mediaMessage.type === 'image') {
                            messageContent.image = { url: mediaMessage.message.url };
                            if (broadcastMessage) messageContent.caption = broadcastMessage;
                        } else if (mediaMessage.type === 'video') {
                            messageContent.video = { url: mediaMessage.message.url };
                            if (broadcastMessage) messageContent.caption = broadcastMessage;
                        } else if (mediaMessage.type === 'document') {
                            messageContent.document = { url: mediaMessage.message.url };
                            messageContent.fileName = mediaMessage.message.fileName;
                            messageContent.mimetype = mediaMessage.message.mimetype;
                            if (broadcastMessage) messageContent.caption = broadcastMessage;
                        } else if (mediaMessage.type === 'audio') {
                            messageContent.audio = { url: mediaMessage.message.url };
                            messageContent.mimetype = 'audio/mp4';
                        } else if (mediaMessage.type === 'sticker') {
                            messageContent.sticker = { url: mediaMessage.message.url };
                        }

                        await sock.sendMessage(contactJid, messageContent);
                    } else {
                        // Send text message
                        await sock.sendMessage(contactJid, {
                            text: broadcastMessage,
                            contextInfo: {
                                externalAdReply: {
                                    title: '📢 Broadcast Message',
                                    body: `From: ${settings.botName}`,
                                    thumbnailUrl: 'https://files.catbox.moe/mq8b1n.png',
                                    sourceUrl: 'https://github.com',
                                    mediaType: 1,
                                    renderLargerThumbnail: false
                                }
                            }
                        });
                    }
                    
                    successCount++;
                    
                    // Small delay to avoid spam detection
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                } catch (error) {
                    console.error(`Failed to send broadcast to ${contactJid}:`, error);
                    failCount++;
                }
            }

            // Send completion report
            let completionText = `✅ **Broadcast Complete!**\n\n📊 **Results:**\n✅ Successfully sent: ${successCount}\n❌ Failed: ${failCount}\n👥 Total contacts: ${contactJids.length}`;
            
            if (excludeNumbers.length > 0) {
                completionText += `\n🚫 Excluded: ${excludeNumbers.length} numbers`;
            }
            
            completionText += `\n\n📢 Message: ${broadcastMessage || 'Media message'}`;
            
            await sock.sendMessage(from, {
                text: completionText,
                contextInfo: {
                    externalAdReply: {
                        title: 'Broadcast Complete',
                        body: `${successCount}/${contactJids.length} sent successfully`,
                        thumbnailUrl: 'https://files.catbox.moe/mq8b1n.png',
                        sourceUrl: 'https://github.com',
                        mediaType: 1,
                        renderLargerThumbnail: false
                    }
                }
            });

        } catch (error) {
            console.error('Broadcast error:', error);
            await sock.sendMessage(from, {
                text: `❌ **Broadcast Failed**\n\nError: ${error.message}`,
                contextInfo: {
                    externalAdReply: {
                        title: 'Broadcast Error',
                        body: 'Failed to execute broadcast',
                        thumbnailUrl: 'https://files.catbox.moe/mq8b1n.png',
                        sourceUrl: 'https://github.com',
                        mediaType: 1,
                        renderLargerThumbnail: false
                    }
                }
            });
        }
    }
};
