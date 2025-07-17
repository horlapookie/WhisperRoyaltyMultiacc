
import { makeWASocket, DisconnectReason, useMultiFileAuthState, delay } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import P from 'pino';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { settings } from '../settings.js';

const logger = P({ level: 'silent' });

export class MultiSessionBotManager {
    constructor() {
        this.sessions = new Map();
        this.reconnectAttempts = new Map();
        this.maxReconnectAttempts = 5;
        this.disconnectedSessions = new Set();
        this.enabledSessions = new Set();
    }

    async initializeAllSessions() {
        console.log('🤖 Starting Multi-Session Bot Manager...');
        console.log('═══════════════════════════════════════');
        
        const availableSessions = await this.getAvailableSessions();
        const totalSessions = settings.sessions.length;
        
        console.log(`📊 Session Status Overview:`);
        console.log(`   📱 Total Slots: ${totalSessions}`);
        console.log(`   ✅ Available: ${availableSessions.length}`);
        console.log(`   ❌ Empty: ${totalSessions - availableSessions.length}`);
        console.log('═══════════════════════════════════════');

        if (availableSessions.length === 0) {
            console.log('⚠️  No session data found. Please add session data to the sessionsettings folder');
            console.log('💡 To add a session:');
            console.log('   1. Add your session base64 data to sessionsettings/sessionX.txt');
            console.log('   2. Update the owner number in settings.js');
            console.log('   3. Redeploy the bot');
            return;
        }

        console.log(`🚀 Initializing ${availableSessions.length} available sessions...`);
        
        for (const sessionConfig of availableSessions) {
            try {
                // Mark session as enabled by default if it has valid data
                this.enabledSessions.add(sessionConfig.id);
                await this.initializeSession(sessionConfig);
                await delay(2000); // Wait 2 seconds between session starts
            } catch (error) {
                console.error(`❌ Failed to initialize session ${sessionConfig.id}:`, error.message);
                // Auto-disable failed sessions
                await this.autoDisableSession(sessionConfig.id, 'INITIALIZATION_FAILED');
            }
        }
        
        // Print final status
        setTimeout(() => {
            const stats = this.getSessionStats();
            console.log('═══════════════════════════════════════');
            console.log('📊 Final Session Status:');
            console.log(`   🟢 Connected: ${stats.connected}`);
            console.log(`   🔄 Connecting: ${stats.available - stats.connected}`);
            console.log(`   🚫 Auto-disabled: ${stats.disconnected}`);
            console.log(`   ✅ Enabled: ${stats.enabled}`);
            console.log('═══════════════════════════════════════');
        }, 30000); // Check after 30 seconds
    }

    async getAvailableSessions() {
        const availableSessions = [];
        
        for (const sessionConfig of settings.sessions) {
            try {
                const sessionFilePath = path.join(process.cwd(), 'sessionsettings', `${sessionConfig.id}.txt`);
                const sessionData = await fs.readFile(sessionFilePath, 'utf8');
                
                // Check if session data exists, is not empty, and is not a placeholder
                const trimmedData = sessionData.trim();
                const placeholderPatterns = [
                    'YOUR_SESSION_ID', 'YOUR_FIRST_SESSION_ID', 'YOUR_SECOND_SESSION_ID',
                    'YOUR_THIRD_SESSION_ID', 'YOUR_FOURTH_SESSION_ID', 'YOUR_FIFTH_SESSION_ID',
                    'YOUR_SIXTH_SESSION_ID', 'YOUR_SEVENTH_SESSION_ID', 'YOUR_EIGHTH_SESSION_ID',
                    'YOUR_NINTH_SESSION_ID', 'YOUR_TENTH_SESSION_ID', 'YOUR_ELEVENTH_SESSION_ID',
                    'YOUR_TWELFTH_SESSION_ID', 'YOUR_THIRTEENTH_SESSION_ID', 'YOUR_FOURTEENTH_SESSION_ID',
                    'YOUR_FIFTEENTH_SESSION_ID'
                ];
                
                if (trimmedData && 
                    trimmedData.length > 10 && 
                    !placeholderPatterns.includes(trimmedData) &&
                    !trimmedData.startsWith('YOUR_')) {
                    
                    // Validate base64 format
                    try {
                        JSON.parse(Buffer.from(trimmedData, 'base64').toString());
                        availableSessions.push({
                            ...sessionConfig,
                            sessionBase64: trimmedData
                        });
                        console.log(`✅ Valid session data found for ${sessionConfig.id}`);
                    } catch (parseError) {
                        console.log(`⚠️  Invalid session data for ${sessionConfig.id}: Not valid base64 JSON`);
                    }
                } else {
                    console.log(`⚠️  Session ${sessionConfig.id} skipped: Empty or placeholder data`);
                }
            } catch (error) {
                // Session file doesn't exist or is empty, skip this session
                console.log(`⚠️  Session ${sessionConfig.id} skipped: No session file found`);
            }
        }
        
        return availableSessions;
    }

    async initializeSession(sessionConfig) {
        console.log(`🚀 Initializing session: ${sessionConfig.id}`);
        console.log(`👑 Owner: ${sessionConfig.ownerNumber}`);
        
        const sessionDir = `./session/${sessionConfig.id}`;
        
        try {
            await fs.access(sessionDir);
        } catch {
            await fs.mkdir(sessionDir, { recursive: true });
        }

        // Decode and save session data
        if (sessionConfig.sessionBase64) {
            try {
                const sessionData = JSON.parse(Buffer.from(sessionConfig.sessionBase64, 'base64').toString());
                await fs.writeFile(path.join(sessionDir, 'creds.json'), JSON.stringify(sessionData, null, 2));
                console.log(`✅ Session data loaded for ${sessionConfig.id}`);
            } catch (error) {
                console.error(`❌ Failed to decode session data for ${sessionConfig.id}:`, error.message);
                return;
            }
        } else {
            console.log(`⚠️ No valid session data found for ${sessionConfig.id}, will generate QR code`);
        }

        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        
        const sock = makeWASocket({
            auth: state,
            logger,
            printQRInTerminal: true,
            browser: [`${settings.botName}-${sessionConfig.id}`, 'Chrome', '1.0.0'],
            defaultQueryTimeoutMs: 60000,
        });

        // Store session info
        this.sessions.set(sessionConfig.id, {
            sock,
            config: sessionConfig,
            saveCreds,
            isConnected: false
        });

        this.setupSessionEventHandlers(sessionConfig.id, sock, saveCreds, sessionConfig);
    }

    setupSessionEventHandlers(sessionId, sock, saveCreds, sessionConfig) {
        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            const sessionInfo = this.sessions.get(sessionId);

            if (qr) {
                console.log(`📱 QR Code for session ${sessionId}:`);
                console.log(qr);
            }

            if (connection === 'close') {
                if (sessionInfo) {
                    sessionInfo.isConnected = false;
                }
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const reason = lastDisconnect?.error?.message || 'Unknown';
                
                console.log(`❌ Session ${sessionId} disconnected: ${reason}`);
                console.log(`📊 Status Code: ${statusCode}`);
                
                // Handle specific error types
                if (reason.includes('Bad MAC') || reason.includes('decryption')) {
                    console.log(`🔧 Session ${sessionId} has encryption issues, clearing session data...`);
                    try {
                        await fs.rm(`./session/${sessionId}`, { recursive: true, force: true });
                        console.log(`🗑️ Cleared corrupted session data for ${sessionId}`);
                    } catch (error) {
                        console.log(`⚠️ Could not clear session data: ${error.message}`);
                    }
                    await this.autoDisableSession(sessionId, 'ENCRYPTION_ERROR');
                    return;
                }
                
                // Only auto-disable if the user manually logged out from WhatsApp
                if (statusCode === DisconnectReason.loggedOut) {
                    console.log(`❌ Session ${sessionId} logged out by user. Auto-disabling session.`);
                    await this.autoDisableSession(sessionId, 'USER_LOGGED_OUT');
                } else if (this.enabledSessions.has(sessionId)) {
                    // For all other disconnect reasons, keep trying to reconnect if enabled
                    console.log(`🔄 Session ${sessionId} will keep trying to reconnect. Disconnect reason: ${reason}`);
                    
                    const attempts = this.reconnectAttempts.get(sessionId) || 0;
                    
                    // Don't retry more than 3 times for encryption errors
                    if (attempts >= 3 && reason.includes('session')) {
                        console.log(`❌ Too many failed attempts for ${sessionId}, auto-disabling...`);
                        await this.autoDisableSession(sessionId, 'MAX_RETRIES_EXCEEDED');
                        return;
                    }
                    
                    this.reconnectAttempts.set(sessionId, attempts + 1);
                    
                    // Wait longer between reconnection attempts to avoid spam
                    const delay_time = Math.min(10000 + (attempts * 5000), 60000); // Max 60 seconds
                    console.log(`⏰ Waiting ${delay_time/1000} seconds before reconnection attempt ${attempts + 1}...`);
                    
                    setTimeout(async () => {
                        console.log(`🔄 Reconnecting session ${sessionId}... (Attempt ${attempts + 1})`);
                        await this.initializeSession(sessionConfig);
                    }, delay_time);
                }
            } else if (connection === 'open') {
                sessionInfo.isConnected = true;
                this.reconnectAttempts.set(sessionId, 0); // Reset reconnection attempts on successful connection
                console.log(`✅ Session ${sessionId} connected successfully!`);
                console.log(`👑 Owner: ${sessionConfig.ownerNumber}`);
                
                // Send connection notification
                try {
                    const randomProfilePic = settings.profilePics[Math.floor(Math.random() * settings.profilePics.length)];
                    await sock.sendMessage(sessionConfig.ownerNumber + '@s.whatsapp.net', {
                        text: `┌─────────────────────────────┐
│   🚀 ${settings.botName} v${settings.version} 🚀   │
└─────────────────────────────┘

🟢 *SESSION ${sessionId.toUpperCase()} CONNECTED*

╭─ 📊 SESSION STATUS ─╮
│ ✨ Bot Name: ${settings.botName}
│ 🔢 Version: v${settings.version}
│ 🎯 Session ID: ${sessionId}
│ 👑 Owner: ${sessionConfig.ownerNumber}
│ ⚡ Prefix: ${settings.prefix}
│ 🌐 Status: 🟢 ONLINE
╰─────────────────────╯

╭─ 🎮 FEATURES READY ─╮
│ • Pokemon Battle System
│ • AI Image Generation  
│ • Music & Media Download
│ • Group Management Tools
│ • 135+ Interactive Commands
╰─────────────────────────╯

⚡ *ALL SYSTEMS OPERATIONAL*
🎯 Ready to dominate WhatsApp! 

Type \`${settings.prefix}help\` to explore commands 🚀`,
                        contextInfo: {
                            externalAdReply: {
                                title: `⚡ ${settings.botName} v${settings.version} ⚡`,
                                body: `🚀 Session ${sessionId} - All Systems Online`,
                                thumbnailUrl: randomProfilePic,
                                sourceUrl: 'https://github.com/horlapookie/WhisperRoyalty',
                                mediaType: 1,
                                renderLargerThumbnail: true
                            }
                        }
                    });
                } catch (error) {
                    console.log(`⚠️ Could not send connection notification to ${sessionConfig.ownerNumber}`);
                }
            }
        });

        // Handle message decryption errors
        sock.ev.on('messages.upsert', (m) => {
            // Check for decryption errors in console and handle gracefully
            const msg = m.messages[0];
            if (!msg) return;
            
            // Skip processing if message content is corrupted
            if (!msg.message && !msg.messageStubType) {
                console.log(`⚠️ Skipping corrupted message in session ${sessionId}`);
                return;
            }
        });

        // Import and setup message handlers
        this.setupMessageHandlers(sessionId, sock, sessionConfig);
    }

    async setupMessageHandlers(sessionId, sock, sessionConfig) {
        // Import the message handling logic
        const { setupMessageHandlers } = await import('./message-handler.js');
        setupMessageHandlers(sock, sessionConfig, sessionId);
    }

    // Session management methods
    async enableSession(sessionId) {
        this.enabledSessions.add(sessionId);
        this.disconnectedSessions.delete(sessionId);
        
        // Find session config and reinitialize if needed
        const sessionConfig = settings.sessions.find(s => s.id === sessionId);
        if (sessionConfig) {
            const sessionData = await this.getSessionData(sessionId);
            if (sessionData && !this.sessions.has(sessionId)) {
                await this.initializeSession({...sessionConfig, sessionBase64: sessionData});
            }
        }
        console.log(`✅ Session ${sessionId} enabled`);
    }

    async disableSession(sessionId) {
        this.enabledSessions.delete(sessionId);
        const sessionInfo = this.sessions.get(sessionId);
        
        if (sessionInfo) {
            try {
                await sessionInfo.sock.logout();
            } catch (error) {
                console.log(`⚠️ Error logging out session ${sessionId}:`, error.message);
            }
            this.sessions.delete(sessionId);
        }
        
        this.reconnectAttempts.delete(sessionId);
        console.log(`🚫 Session ${sessionId} disabled`);
    }

    async getSessionData(sessionId) {
        try {
            const sessionFilePath = path.join(process.cwd(), 'sessionsettings', `${sessionId}.txt`);
            const sessionData = await fs.readFile(sessionFilePath, 'utf8');
            return sessionData.trim();
        } catch (error) {
            return null;
        }
    }

    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }

    getAllSessions() {
        return Array.from(this.sessions.values());
    }

    getConnectedSessions() {
        return Array.from(this.sessions.values()).filter(session => session.isConnected);
    }

    async autoDisableSession(sessionId, reason) {
        console.log(`🚫 Auto-disabling session ${sessionId} due to: ${reason}`);
        
        // Add to disconnected sessions set
        this.disconnectedSessions.add(sessionId);
        this.enabledSessions.delete(sessionId);
        
        // Remove from active sessions
        this.sessions.delete(sessionId);
        this.reconnectAttempts.delete(sessionId);
        
        console.log(`📊 Session ${sessionId} has been automatically disabled and removed from active sessions.`);
    }

    isSessionDisconnected(sessionId) {
        return this.disconnectedSessions.has(sessionId);
    }

    isSessionEnabled(sessionId) {
        return this.enabledSessions.has(sessionId);
    }

    getSessionStats() {
        const total = settings.sessions.length;
        const enabled = this.enabledSessions.size;
        const connected = this.getConnectedSessions().length;
        const disconnected = this.disconnectedSessions.size;
        const available = settings.sessions.filter(s => {
            // Check if session has valid data
            try {
                const sessionFilePath = path.join(process.cwd(), 'sessionsettings', `${s.id}.txt`);
                return fs.existsSync(sessionFilePath);
            } catch {
                return false;
            }
        }).length;
        
        return {
            total,
            enabled,
            connected,
            disconnected,
            available,
            activeAttempts: this.reconnectAttempts.size
        };
    }

    async broadcastToAllSessions(message) {
        const connectedSessions = this.getConnectedSessions();
        const results = [];

        for (const session of connectedSessions) {
            try {
                const result = await session.sock.sendMessage(session.config.ownerNumber + '@s.whatsapp.net', message);
                results.push({ sessionId: session.config.id, success: true, result });
            } catch (error) {
                results.push({ sessionId: session.config.id, success: false, error: error.message });
            }
        }

        return results;
    }

    // Get all available session IDs
    getAvailableSessionIds() {
        return settings.sessions.map(s => s.id);
    }

    // Get session status
    getSessionStatus(sessionId) {
        const sessionInfo = this.sessions.get(sessionId);
        const isEnabled = this.enabledSessions.has(sessionId);
        const isConnected = sessionInfo ? sessionInfo.isConnected : false;
        const isDisconnected = this.disconnectedSessions.has(sessionId);
        
        if (isDisconnected) return 'disconnected';
        if (isConnected) return 'connected';
        if (isEnabled) return 'connecting';
        return 'disabled';
    }
}
