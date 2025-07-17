
export const command = {
    name: 'sessions',
    aliases: ['session', 'session-list', 'list-sessions'],
    description: 'Comprehensive session management system',
    usage: 'sessions [list|status|enable|disable|restart|broadcast] [sessionId] [message]',
    category: 'system',
    cooldown: 3,
    
    async execute(sock, msg, args, context) {
        const { from, sender, isOwner, sessionId } = context;
        const CREATOR_NUMBER = '2349122222622';
        
        // Extract phone number from sender
        const senderNumber = sender.replace('@s.whatsapp.net', '');
        const isCreator = senderNumber === CREATOR_NUMBER;
        
        if (!isOwner && !isCreator) {
            await sock.sendMessage(from, {
                text: '❌ **Access Denied**\n\n🔒 This command is restricted to bot owners and creator only.',
                contextInfo: {
                    externalAdReply: {
                        title: 'Sessions Management',
                        body: 'Owner/Creator access required',
                        thumbnailUrl: 'https://files.catbox.moe/mq8b1n.png',
                        sourceUrl: 'https://github.com',
                        mediaType: 1,
                        renderLargerThumbnail: false
                    }
                }
            });
            return;
        }

        const botManager = global.botManager;
        if (!botManager) {
            await sock.sendMessage(from, {
                text: '❌ Bot manager not available'
            });
            return;
        }

        const action = args.split(' ')[0]?.toLowerCase() || 'list';
        const targetSessionId = args.split(' ')[1];
        const message = args.substring(args.indexOf(' ', args.indexOf(' ') + 1) + 1);

        switch (action) {
            case 'list':
            case 'status':
                const stats = botManager.getSessionStats();
                const allSessions = botManager.getAvailableSessionIds();
                
                let statusMsg = `🤖 **MULTI-SESSION STATUS REPORT**\n\n`;
                statusMsg += `📊 **OVERVIEW:**\n`;
                statusMsg += `   📱 Total Sessions: ${stats.total}\n`;
                statusMsg += `   📂 Available Data: ${stats.available}\n`;
                statusMsg += `   🟢 Connected: ${stats.connected}\n`;
                statusMsg += `   ⚡ Enabled: ${stats.enabled}\n`;
                statusMsg += `   🚫 Disconnected: ${stats.disconnected}\n`;
                statusMsg += `   🔄 Reconnecting: ${stats.activeAttempts}\n\n`;
                
                statusMsg += `📋 **SESSION DETAILS:**\n`;
                
                for (const sessionId of allSessions) {
                    const status = botManager.getSessionStatus(sessionId);
                    const sessionConfig = botManager.sessions.get(sessionId)?.config;
                    const owner = sessionConfig?.ownerNumber || 'Unknown';
                    
                    let statusIcon = '';
                    let statusText = '';
                    
                    switch (status) {
                        case 'connected':
                            statusIcon = '🟢';
                            statusText = 'ONLINE';
                            break;
                        case 'connecting':
                            statusIcon = '🔄';
                            statusText = 'CONNECTING';
                            break;
                        case 'disconnected':
                            statusIcon = '🚫';
                            statusText = 'AUTO-DISABLED';
                            break;
                        case 'disabled':
                            statusIcon = '⚪';
                            statusText = 'DISABLED';
                            break;
                        default:
                            statusIcon = '❓';
                            statusText = 'UNKNOWN';
                    }
                    
                    statusMsg += `${statusIcon} **${sessionId.toUpperCase()}** | ${statusText}\n`;
                    statusMsg += `   👑 Owner: ${owner}\n`;
                    if (sessionConfig) {
                        statusMsg += `   📍 Current Session: ${sessionConfig.id === sessionId ? '✅' : '❌'}\n`;
                    }
                    statusMsg += `\n`;
                }
                
                if (isCreator) {
                    statusMsg += `🛠️ **CREATOR COMMANDS:**\n`;
                    statusMsg += `• \`sessions enable <sessionId>\` - Enable session\n`;
                    statusMsg += `• \`sessions disable <sessionId>\` - Disable session\n`;
                    statusMsg += `• \`sessions restart <sessionId>\` - Restart session\n`;
                    statusMsg += `• \`sessions broadcast <message>\` - Broadcast to all\n\n`;
                    statusMsg += `💡 Example: \`sessions enable session7\`\n`;
                }
                
                statusMsg += `⏰ Last updated: ${new Date().toLocaleTimeString()}`;
                
                await sock.sendMessage(from, {
                    text: statusMsg,
                    contextInfo: {
                        externalAdReply: {
                            title: '🤖 Multi-Session Manager',
                            body: `${stats.connected}/${stats.available} sessions online`,
                            thumbnailUrl: 'https://files.catbox.moe/mq8b1n.png',
                            sourceUrl: 'https://github.com',
                            mediaType: 1,
                            renderLargerThumbnail: true
                        }
                    }
                });
                break;

            case 'enable':
                if (!isCreator) {
                    await sock.sendMessage(from, {
                        text: '❌ Only the creator can enable/disable sessions.'
                    });
                    return;
                }
                
                if (!targetSessionId) {
                    await sock.sendMessage(from, {
                        text: '❌ Please specify a session ID\n\nUsage: `sessions enable <sessionId>`'
                    });
                    return;
                }
                
                try {
                    await botManager.enableSession(targetSessionId);
                    await sock.sendMessage(from, {
                        text: `✅ **Session Enabled**\n\n🟢 Session **${targetSessionId}** has been enabled and will attempt to connect.`
                    });
                } catch (error) {
                    await sock.sendMessage(from, {
                        text: `❌ Failed to enable session ${targetSessionId}: ${error.message}`
                    });
                }
                break;

            case 'disable':
                if (!isCreator) {
                    await sock.sendMessage(from, {
                        text: '❌ Only the creator can enable/disable sessions.'
                    });
                    return;
                }
                
                if (!targetSessionId) {
                    await sock.sendMessage(from, {
                        text: '❌ Please specify a session ID\n\nUsage: `sessions disable <sessionId>`'
                    });
                    return;
                }
                
                try {
                    await botManager.disableSession(targetSessionId);
                    await sock.sendMessage(from, {
                        text: `🚫 **Session Disabled**\n\n⚪ Session **${targetSessionId}** has been disabled and disconnected.`
                    });
                } catch (error) {
                    await sock.sendMessage(from, {
                        text: `❌ Failed to disable session ${targetSessionId}: ${error.message}`
                    });
                }
                break;

            case 'restart':
                if (!isCreator) {
                    await sock.sendMessage(from, {
                        text: '❌ Only the creator can restart sessions.'
                    });
                    return;
                }
                
                if (!targetSessionId) {
                    await sock.sendMessage(from, {
                        text: '❌ Please specify a session ID\n\nUsage: `sessions restart <sessionId>`'
                    });
                    return;
                }
                
                try {
                    await botManager.disableSession(targetSessionId);
                    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
                    await botManager.enableSession(targetSessionId);
                    
                    await sock.sendMessage(from, {
                        text: `🔄 **Session Restart**\n\n♻️ Session **${targetSessionId}** has been restarted and will reconnect shortly.`
                    });
                } catch (error) {
                    await sock.sendMessage(from, {
                        text: `❌ Failed to restart session ${targetSessionId}: ${error.message}`
                    });
                }
                break;

            case 'broadcast':
                if (!isCreator) {
                    await sock.sendMessage(from, {
                        text: '❌ Only the creator can broadcast to all sessions.'
                    });
                    return;
                }
                
                if (!message || message.trim().length === 0) {
                    await sock.sendMessage(from, {
                        text: '❌ Please provide a message to broadcast\n\nUsage: `sessions broadcast <message>`'
                    });
                    return;
                }
                
                const broadcastMessage = {
                    text: `📢 **CREATOR BROADCAST**\n\n${message}\n\n━━━━━━━━━━━━━━━━━━━━\n👑 From: Creator\n⏰ Time: ${new Date().toLocaleString()}\n🤖 Via: Multi-Session Manager`
                };
                
                const results = await botManager.broadcastToAllSessions(broadcastMessage);
                
                let resultText = `📢 **Broadcast Results:**\n\n`;
                resultText += `📊 Sent to ${results.length} active sessions:\n\n`;
                
                results.forEach(result => {
                    const status = result.success ? '✅ Delivered' : '❌ Failed';
                    resultText += `${status} - ${result.sessionId}\n`;
                    if (!result.success) {
                        resultText += `   Error: ${result.error}\n`;
                    }
                });
                
                resultText += `\n⏰ Broadcast completed at ${new Date().toLocaleTimeString()}`;
                
                await sock.sendMessage(from, { 
                    text: resultText,
                    contextInfo: {
                        externalAdReply: {
                            title: '📢 Broadcast Complete',
                            body: `Sent to ${results.filter(r => r.success).length}/${results.length} sessions`,
                            thumbnailUrl: 'https://files.catbox.moe/mq8b1n.png',
                            sourceUrl: 'https://github.com',
                            mediaType: 1,
                            renderLargerThumbnail: false
                        }
                    }
                });
                break;
                
            default:
                const helpMsg = `🤖 **SESSIONS COMMAND HELP**\n\n`;
                const commands = [
                    '`sessions list` - Show all session statuses',
                    '`sessions status` - Same as list',
                ];
                
                if (isCreator) {
                    commands.push(
                        '`sessions enable <sessionId>` - Enable a session',
                        '`sessions disable <sessionId>` - Disable a session',  
                        '`sessions restart <sessionId>` - Restart a session',
                        '`sessions broadcast <message>` - Broadcast to all sessions'
                    );
                }
                
                await sock.sendMessage(from, {
                    text: helpMsg + commands.join('\n') + `\n\n💡 Your access level: ${isCreator ? '👑 Creator' : '👤 Owner'}`,
                    contextInfo: {
                        externalAdReply: {
                            title: 'Sessions Help',
                            body: 'Multi-session management',
                            thumbnailUrl: 'https://files.catbox.moe/mq8b1n.png',
                            sourceUrl: 'https://github.com',
                            mediaType: 1,
                            renderLargerThumbnail: false
                        }
                    }
                });
                break;
        }
    }
};
