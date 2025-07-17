import fs from 'fs/promises';
import path from 'path';
import { settings } from '../settings.js';

// Creator number
const CREATOR_NUMBER = '2349122222622';

export const command = {
    name: 'sessionmanager',
    aliases: ['sessions', 'sm', 'session-manager'],
    category: 'Creator',
    description: 'Manage bot sessions (creator only)',
    usage: 'sessionmanager <action> [sessionId] [ownerNumber] [sessionBase64]',
    execute: async (sock, msg, args, context) => {
        console.log(`Session Manager Command executed by: ${context.sender}`);
        const { from, sender } = context;

        // Extract phone number from sender (remove @s.whatsapp.net)
        const senderNumber = sender.replace('@s.whatsapp.net', '');

        // Check if sender is the creator
        if (senderNumber !== CREATOR_NUMBER) {
            await sock.sendMessage(from, {
                text: '❌ This command is restricted to the bot creator only.',
                contextInfo: {
                    externalAdReply: {
                        title: 'Access Denied',
                        body: 'Creator command only',
                        thumbnailUrl: 'https://files.catbox.moe/mq8b1n.png',
                        sourceUrl: 'https://github.com',
                        mediaType: 1,
                        renderLargerThumbnail: false
                    }
                }
            });
            return;
        }

        const action = args.split(' ')[0]?.toLowerCase();
        const sessionId = args.split(' ')[1];

        if (!global.botManager) {
            await sock.sendMessage(from, {
                text: '❌ Bot manager not available.'
            });
            return;
        }

        switch (action) {
            case 'status':
            case 'info':
                let statusMsg = `🛠️ *SESSION MANAGER STATUS*\n\n`;
                const stats = global.botManager ? global.botManager.getSessionStats() : { total: 0, enabled: 0, connected: 0, disconnected: 0, available: 0 };
                const availableSessionFiles = await this.getAvailableSessionFiles();
                const availableSlots = this.getAvailableSessionIds(availableSessionFiles).length;

                statusMsg += `📊 *OVERVIEW:*\n`;
                statusMsg += `   🎯 Total Slots: ${stats.total}\n`;
                statusMsg += `   📂 Available Data: ${stats.available}\n`;
                statusMsg += `   ✅ Enabled: ${stats.enabled}\n`;
                statusMsg += `   🟢 Connected: ${stats.connected}\n`;
                statusMsg += `   🚫 Disconnected: ${stats.disconnected}\n`;
                statusMsg += `   🆓 Empty Slots: ${availableSlots}\n\n`;

                if (global.botManager) {
                    statusMsg += `🟢 *CONNECTED SESSIONS:*\n`;
                    const connectedSessions = global.botManager.getConnectedSessions();
                    if (connectedSessions.length > 0) {
                        connectedSessions.forEach(session => {
                            const status = global.botManager.getSessionStatus(session.config.id);
                            statusMsg += `   • ${session.config.id} (${session.config.ownerNumber}) - ${status.toUpperCase()}\n`;
                        });
                    } else {
                        statusMsg += `   No sessions currently connected\n`;
                    }
                    statusMsg += `\n`;

                    statusMsg += `⚡ *ALL SESSIONS STATUS:*\n`;
                    const allSessionIds = global.botManager.getAvailableSessionIds();
                    allSessionIds.forEach(sessionId => {
                        const status = global.botManager.getSessionStatus(sessionId);
                        const icons = {
                            'connected': '🟢',
                            'connecting': '🔄', 
                            'disconnected': '🚫',
                            'disabled': '⚪'
                        };
                        statusMsg += `   ${icons[status] || '❓'} ${sessionId} - ${status.toUpperCase()}\n`;
                    });
                    statusMsg += `\n`;
                }

                statusMsg += `💡 Use: .sessionmanager add <sessionId> <number> <base64>\n`;
                statusMsg += `⏰ Last updated: ${new Date().toLocaleTimeString()}`;

                await sock.sendMessage(from, {
                    text: statusMsg,
                    contextInfo: {
                        externalAdReply: {
                            title: 'Session Manager',
                            body: 'Multi-session status overview',
                            thumbnailUrl: 'https://files.catbox.moe/mq8b1n.png',
                            sourceUrl: 'https://github.com',
                            mediaType: 1,
                            renderLargerThumbnail: true
                        }
                    }
                });
                break;

            case 'add':
                const sessionId = args.split(' ')[1];
                const ownerNumber = args.split(' ')[2];
                const sessionBase64Parts = args.split(' ').slice(3);

                if (!sessionId || !ownerNumber || !sessionBase64Parts.length) {
                    await sock.sendMessage(from, {
                        text: `❌ *Invalid Usage*\n\n**Format:** .sessionmanager add <sessionId> <ownerNumber> <sessionBase64>\n\n**Example:** .sessionmanager add session7 2349123456789 eyJub2lzZUtleS...\n\n**Note:** Make sure the sessionBase64 is complete and valid.`
                    });
                    return;
                }

                const sessionBase64 = sessionBase64Parts.join(' ');

                try {
                    // Validate session ID format
                    if (!sessionId.match(/^session([1-9]|1[0-5])$/)) {
                        await sock.sendMessage(from, {
                            text: '❌ Invalid session ID. Use session1 to session15 only.'
                        });
                        return;
                    }

                    // Check if session already exists
                    const sessionFilePath = path.join(process.cwd(), 'sessionsettings', `${sessionId}.txt`);
                    try {
                        await fs.access(sessionFilePath);
                        await sock.sendMessage(from, {
                            text: `❌ Session ${sessionId} already exists. Use a different session ID.`
                        });
                        return;
                    } catch {
                        // Session doesn't exist, continue
                    }

                    // Validate base64 and phone number
                    const decodedData = Buffer.from(sessionBase64, 'base64').toString();
                    JSON.parse(decodedData);

                    if (!ownerNumber.match(/^\d{10,15}$/)) {
                        await sock.sendMessage(from, {
                            text: '❌ Invalid phone number format. Use numbers only (10-15 digits).'
                        });
                        return;
                    }

                    // Save session data to file
                    await fs.writeFile(sessionFilePath, sessionBase64);

                    // Update settings.js
                    await this.updateSettingsFile(sessionId, ownerNumber);

                    await sock.sendMessage(from, {
                        text: `✅ **Session Added Successfully**\n\n🆔 **Session ID:** ${sessionId}\n📱 **Owner Number:** ${ownerNumber}\n📂 **File:** sessionsettings/${sessionId}.txt\n⚙️ **Settings:** Updated automatically\n\n**Next Steps:**\n1. Restart the bot to activate the new session\n2. The session will auto-connect on next startup\n\n**Note:** Session data has been saved securely.`,
                        contextInfo: {
                            externalAdReply: {
                                title: 'Session Manager',
                                body: 'Session added successfully',
                                thumbnailUrl: 'https://files.catbox.moe/mq8b1n.png',
                                sourceUrl: 'https://github.com',
                                mediaType: 1
                            }
                        }
                    });

                } catch (error) {
                    await sock.sendMessage(from, {
                        text: `❌ **Error Adding Session**\n\n**Error:** ${error.message}\n\n**Possible Issues:**\n- Invalid base64 session data\n- Corrupted session format\n- File system error\n\n**Solution:** Ensure the session data is valid and complete.`
                    });
                }
                break;

            case 'restart':
                if (sessionId) {
                    const session = global.botManager.getSession(sessionId);
                    if (session) {
                        await sock.sendMessage(from, {
                            text: `🔄 Restarting session ${sessionId}...`
                        });
                        // Remove and reinitialize
                        global.botManager.sessions.delete(sessionId);
                        const sessionConfig = settings.sessions.find(s => s.id === sessionId);
                        if (sessionConfig && sessionConfig.enabled) {
                            await global.botManager.initializeSession(sessionConfig);
                        }
                    } else {
                        await sock.sendMessage(from, {
                            text: `❌ Session ${sessionId} not found or not active.`
                        });
                    }
                } else {
                    await sock.sendMessage(from, {
                        text: '❓ Usage: sessionmanager restart <sessionId>'
                    });
                }
                break;

            case 'enable':
                if (sessionId) {
                    try {
                        await global.botManager.updateSessionStatus(sessionId, true);
                        await sock.sendMessage(from, {
                            text: `✅ Session ${sessionId} enabled. Restart bot to activate.`
                        });
                    } catch (error) {
                        await sock.sendMessage(from, {
                            text: `❌ Failed to enable session ${sessionId}: ${error.message}`
                        });
                    }
                } else {
                    await sock.sendMessage(from, {
                        text: '❓ Usage: sessionmanager enable <sessionId>'
                    });
                }
                break;

            case 'disable':
                if (sessionId) {
                    try {
                        await global.botManager.updateSessionStatus(sessionId, false);
                        await global.botManager.autoDisableSession(sessionId, 'MANUAL_DISABLE');
                        await sock.sendMessage(from, {
                            text: `❌ Session ${sessionId} disabled and disconnected.`
                        });
                    } catch (error) {
                        await sock.sendMessage(from, {
                            text: `❌ Failed to disable session ${sessionId}: ${error.message}`
                        });
                    }
                } else {
                    await sock.sendMessage(from, {
                        text: '❓ Usage: sessionmanager disable <sessionId>'
                    });
                }
                break;

            case 'broadcast':
                const message = args.substring(args.indexOf(' ') + 1);
                if (message) {
                    const results = await global.botManager.broadcastToAllSessions({
                        text: `📢 *BROADCAST MESSAGE*\n\n${message}\n\n> Sent to all connected sessions`
                    });

                    let resultMsg = `📢 Broadcast sent to ${results.length} sessions:\n\n`;
                    results.forEach(result => {
                        resultMsg += `${result.success ? '✅' : '❌'} ${result.sessionId}\n`;
                    });

                    await sock.sendMessage(from, {
                        text: resultMsg
                    });
                } else {
                    await sock.sendMessage(from, {
                        text: '❓ Usage: sessionmanager broadcast <message>'
                    });
                }
                break;

            default:
                await sock.sendMessage(from, {
                    text: `🛠️ *SESSION MANAGER* (Creator Only)\n\n` +
                          `📋 Available Commands:\n` +
                          `• status - View session overview & available slots\n` +
                          `• add <sessionId> <number> <base64> - Add new session\n` +
                          `• restart <sessionId> - Restart specific session\n` +
                          `• enable <sessionId> - Enable session\n` +
                          `• disable <sessionId> - Disable session\n` +
                          `• broadcast <message> - Send to all sessions\n\n` +
                          `💡 Examples:\n` +
                          `• .sessionmanager status\n` +
                          `• .sessionmanager add session7 2349123456789 eyJub2lzZUtleS...`,
                    contextInfo: {
                        externalAdReply: {
                            title: 'Session Manager Help',
                            body: 'Multi-session management tools',
                            thumbnailUrl: 'https://files.catbox.moe/mq8b1n.png',
                            sourceUrl: 'https://github.com',
                            mediaType: 1,
                            renderLargerThumbnail: true
                        }
                    }
                });
        }
    },

    async getAvailableSessionFiles() {
        try {
            const sessionFiles = await fs.readdir(path.join(process.cwd(), 'sessionsettings'));
            return sessionFiles
                .filter(file => file.endsWith('.txt') && file !== 'placeholder.txt')
                .map(file => file.replace('.txt', ''));
        } catch (error) {
            return [];
        }
    },

    getAvailableSessionIds(usedSessions) {
        const allSessions = Array.from({length: 15}, (_, i) => `session${i + 1}`);
        return allSessions.filter(session => !usedSessions.includes(session));
    },

    async updateSettingsFile(sessionId, ownerNumber) {
        try {
            const settingsPath = path.join(process.cwd(), 'settings.js');
            let settingsContent = await fs.readFile(settingsPath, 'utf8');

            // Find the specific session and update it
            const sessionRegex = new RegExp(
                `(\\s*\\{[^}]*id:\\s*['"]${sessionId}['"][^}]*ownerNumber:\\s*['"])([^'"]*)(['"][^}]*ownerNumbers:\\s*\\[\\s*['"])([^'"]*)(['"]@s\\.whatsapp\\.net['"][^}]*\\})`,
                'g'
            );

            // Check if session already exists in settings
            if (sessionRegex.test(settingsContent)) {
                // Update existing session
                settingsContent = settingsContent.replace(sessionRegex, `$1${ownerNumber}$3${ownerNumber}$5`);
            } else {
                // Find a placeholder session to replace
                const placeholderRegex = new RegExp(
                    `(\\s*\\{[^}]*id:\\s*['"]${sessionId}['"][^}]*ownerNumber:\\s*['"])YOUR_[^']*_NUMBER(['"][^}]*ownerNumbers:\\s*\\[\\s*['"])YOUR_[^']*_NUMBER@s\\.whatsapp\\.net(['"][^}]*\\})`,
                    'g'
                );

                if (placeholderRegex.test(settingsContent)) {
                    settingsContent = settingsContent.replace(placeholderRegex, `$1${ownerNumber}$2${ownerNumber}@s.whatsapp.net$3`);
                }
            }

            await fs.writeFile(settingsPath, settingsContent, 'utf8');
        } catch (error) {
            throw new Error(`Failed to update settings: ${error.message}`);
        }
    }
    }
};
import fs from 'fs/promises';
import path from 'path';

export const command = {
    name: 'session',
    aliases: ['addsession', 'ses'],
    description: 'Add or manage bot sessions',
    usage: 'session add <sessionId> <ownerNumber> <sessionBase64>',
    category: 'Owner',
    ownerOnly: true,

    async execute(sock, msg, args, context) {
        const { from, sender, settings, isOwner } = context;

        if (!isOwner) {
            await sock.sendMessage(from, { text: '❌ This command is only for bot owners.' });
            return;
        }

        const [action, sessionId, ownerNumber, ...sessionBase64Parts] = args.split(' ');

        if (action === 'add') {
            if (!sessionId || !ownerNumber || !sessionBase64Parts.length) {
                await sock.sendMessage(from, {
                    text: `❌ **Invalid Usage**

**Format:** .session add <sessionId> <ownerNumber> <sessionBase64>

**Example:** .session add session7 2349123456789 eyJub2lzZUtleS...

**Note:** Make sure the sessionBase64 is complete and valid.`
                });
                return;
            }

            const sessionBase64 = sessionBase64Parts.join(' ');

            try {
                // Validate base64
                const decodedData = Buffer.from(sessionBase64, 'base64').toString();
                JSON.parse(decodedData);

                // Save session data to file
                const sessionFilePath = path.join(process.cwd(), 'sessionsettings', `${sessionId}.txt`);
                await fs.writeFile(sessionFilePath, sessionBase64);

                // Update settings.js
                await this.updateSettingsFile(sessionId, ownerNumber);

                await sock.sendMessage(from, {
                    text: `✅ **Session Added Successfully**

🆔 **Session ID:** ${sessionId}
📱 **Owner Number:** ${ownerNumber}
📂 **File:** sessionsettings/${sessionId}.txt
⚙️ **Settings:** Updated automatically

**Next Steps:**
1. Restart the bot to activate the new session
2. The session will auto-connect on next startup

**Note:** Session data has been saved securely.`,
                    contextInfo: {
                        externalAdReply: {
                            title: 'Session Manager',
                            body: 'Session added successfully',
                            thumbnailUrl: settings.profilePics[Math.floor(Math.random() * settings.profilePics.length)],
                            sourceUrl: 'https://github.com',
                            mediaType: 1
                        }
                    }
                });

            } catch (error) {
                await sock.sendMessage(from, {
                    text: `❌ **Error Adding Session**

**Error:** ${error.message}

**Possible Issues:**
- Invalid base64 session data
- Corrupted session format
- File system error

**Solution:** Ensure the session data is valid and complete.`
                });
            }

        } else if (action === 'list') {
            try {
                const sessionFiles = await fs.readdir(path.join(process.cwd(), 'sessionsettings'));
                const sessionList = sessionFiles
                    .filter(file => file.endsWith('.txt'))
                    .map(file => file.replace('.txt', ''));

                await sock.sendMessage(from, {
                    text: `📋 **Available Sessions**

${sessionList.map((session, index) => `${index + 1}. ${session}`).join('\n')}

**Total Sessions:** ${sessionList.length}
**Active Sessions:** ${global.botManager ? global.botManager.sessions.size : 0}

Use \`.session add <id> <number> <base64>\` to add new sessions.`
                });

            } catch (error) {
                await sock.sendMessage(from, {
                    text: '❌ Error reading session files.'
                });
            }

        } else {
            await sock.sendMessage(from, {
                text: `🔧 **Session Manager**

**Commands:**
• \`.session add <sessionId> <ownerNumber> <sessionBase64>\` - Add new session
• \`.session list\` - List all available sessions

**Examples:**
• \`.session add session7 2349123456789 eyJub2lzZUtleS...\`
• \`.session list\`

**Note:** Only bot owners can manage sessions.`
            });
        }
    },

    async updateSettingsFile(sessionId, ownerNumber) {
        try {
            const settingsPath = path.join(process.cwd(), 'settings.js');
            let settingsContent = await fs.readFile(settingsPath, 'utf8');

            // Find the sessions array and add new session
            const sessionEntry = `        {
            id: '${sessionId}',
            ownerNumber: '${ownerNumber}',
            ownerNumbers: ['${ownerNumber}@s.whatsapp.net']
        },`;

            // Insert before the last session entry
            const insertPoint = settingsContent.lastIndexOf('        }');
            if (insertPoint !== -1) {
                settingsContent = settingsContent.slice(0, insertPoint) + 
                    sessionEntry + '\n' + 
                    settingsContent.slice(insertPoint);
            }

            await fs.writeFile(settingsPath, settingsContent, 'utf8');
        } catch (error) {
            throw new Error(`Failed to update settings: ${error.message}`);
        }
    }
};