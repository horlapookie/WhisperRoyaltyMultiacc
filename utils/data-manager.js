import fs from 'fs';
import path from 'path';

const DATA_DIR = './data';
const PLAYER_DATA_FILE = path.join(DATA_DIR, 'player-data.json');
const BATTLE_DATA_FILE = path.join(DATA_DIR, 'battle-data.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

export class DataManager {
    constructor() {
        this.playerData = this.loadPlayerData();
        this.battleData = this.loadBattleData();
    }

    // Load player data from JSON file
    loadPlayerData() {
        try {
            if (fs.existsSync(PLAYER_DATA_FILE)) {
                const data = fs.readFileSync(PLAYER_DATA_FILE, 'utf8');
                return JSON.parse(data);
            }
        } catch (error) {
            console.error('Error loading player data:', error);
        }
        return {
            playerPokemon: {},
            playerStats: {},
            playerLeaderboard: {}
        };
    }

    // Save player data to JSON file
    savePlayerData() {
        try {
            const data = {
                playerPokemon: this.playerData.playerPokemon || {},
                playerStats: this.playerData.playerStats || {},
                playerLeaderboard: this.playerData.playerLeaderboard || {}
            };
            fs.writeFileSync(PLAYER_DATA_FILE, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('Error saving player data:', error);
        }
    }

    // Load battle data from JSON file
    loadBattleData() {
        try {
            if (fs.existsSync(BATTLE_DATA_FILE)) {
                const data = fs.readFileSync(BATTLE_DATA_FILE, 'utf8');
                return JSON.parse(data);
            }
        } catch (error) {
            console.error('Error loading battle data:', error);
        }
        return {
            battleLeaderboard: {},
            activeBattles: {}
        };
    }

    // Save battle data to JSON file
    saveBattleData() {
        try {
            const data = {
                battleLeaderboard: this.battleData.battleLeaderboard || {},
                activeBattles: this.battleData.activeBattles || {}
            };
            fs.writeFileSync(BATTLE_DATA_FILE, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('Error saving battle data:', error);
        }
    }

    // Player Pokemon methods
    getPlayerPokemon(playerId) {
        return this.playerData.playerPokemon[playerId] || [];
    }

    setPlayerPokemon(playerId, pokemon) {
        this.playerData.playerPokemon[playerId] = pokemon;
        this.savePlayerData();
    }

    addPlayerPokemon(playerId, pokemon) {
        if (!this.playerData.playerPokemon[playerId]) {
            this.playerData.playerPokemon[playerId] = [];
        }
        this.playerData.playerPokemon[playerId].push(pokemon);
        this.savePlayerData();
    }

    // Player Stats methods
    getPlayerStats(playerId) {
        return this.playerData.playerStats[playerId] || {
            wins: 0,
            losses: 0,
            battles: 0,
            pokemonCaught: 0,
            trainingCount: 0,
            gold: 0
        };
    }

    setPlayerStats(playerId, stats) {
        this.playerData.playerStats[playerId] = stats;
        this.savePlayerData();
    }

    savePlayerStats(playerId, stats) {
        this.playerData.playerStats[playerId] = stats;
        this.savePlayerData();
    }

    updatePlayerStats(playerId, updates) {
        const current = this.getPlayerStats(playerId);
        const updated = { ...current, ...updates };
        this.setPlayerStats(playerId, updated);
    }

    // Battle Leaderboard methods
    getBattleLeaderboard() {
        return this.battleData.battleLeaderboard || {};
    }

    setBattleLeaderboard(leaderboard) {
        this.battleData.battleLeaderboard = leaderboard;
        this.saveBattleData();
    }

    updateBattleLeaderboard(playerId, won) {
        const leaderboard = this.getBattleLeaderboard();
        if (!leaderboard[playerId]) {
            leaderboard[playerId] = { wins: 0, losses: 0, battles: 0 };
        }

        leaderboard[playerId].battles++;
        if (won) {
            leaderboard[playerId].wins++;
        } else {
            leaderboard[playerId].losses++;
        }

        this.setBattleLeaderboard(leaderboard);
    }

    // Auto-save every 30 seconds
    startAutoSave() {
        setInterval(() => {
            this.savePlayerData();
            this.saveBattleData();
        }, 30000);
    }
}

// Create global instance
export const dataManager = new DataManager();

// Utility functions
export function extractPhoneNumber(jid) {
    if (!jid) return null;

    // Handle different JID formats
    if (jid.includes('@')) {
        let phoneNumber = jid.split('@')[0];

        // Handle WhatsApp's different JID formats
        if (phoneNumber.includes(':')) {
            // Format: number:deviceId@s.whatsapp.net
            phoneNumber = phoneNumber.split(':')[0];
        }

        // Remove any non-numeric characters except the leading +
        phoneNumber = phoneNumber.replace(/[^\d+]/g, '');

        // If it starts with +, remove it for consistency
        if (phoneNumber.startsWith('+')) {
            phoneNumber = phoneNumber.substring(1);
        }

        return phoneNumber;
    }

    // If no @ symbol, assume it's already a phone number
    return jid.replace(/[^\d]/g, '');
}

// New function to get the real phone number from group participant
export function getRealPhoneNumber(participantJid) {
    if (!participantJid) return null;

    // Extract the base number part
    let phoneNumber = participantJid.split('@')[0];

    // Handle different WhatsApp JID formats in groups
    if (phoneNumber.includes(':')) {
        // Format: number:deviceId@s.whatsapp.net or number:suffix@s.whatsapp.net
        phoneNumber = phoneNumber.split(':')[0];
    }

    // Remove any non-numeric characters
    phoneNumber = phoneNumber.replace(/[^\d]/g, '');

    // Sometimes WhatsApp uses different formats, try to normalize
    if (phoneNumber.length > 15) {
        // If too long, might be a different format, take first reasonable part
        phoneNumber = phoneNumber.substring(0, 15);
    }

    return phoneNumber;
}

export function formatTime(date) {
    return date.toLocaleString();
}

// Bot state management
const BOT_STATE_FILE = path.join(DATA_DIR, 'bot-state.json');

// Default bot state with all required properties
const defaultBotState = {
    isOn: true,
    isPublic: true,
    autoViewStatus: false,
    autoReact: false,
    chatbotEnabled: false,
    autoTyping: false,
    autoRecording: false,
    autoReadMessage: false,
    autoReactStatus: false,
    autoStatusEmoji: '♦️',
    autoDeleteAlert: false,
    bannedUsers: [],
    ownerJid: null,
    ownerJids: []
};

export async function saveBotState(sessionId, state) {
    try {
        const sessionStateFile = path.join(DATA_DIR, `bot-state-${sessionId}.json`);
        fs.writeFileSync(sessionStateFile, JSON.stringify(state, null, 2));
    } catch (error) {
        console.error('Error saving bot state:', error);
    }
}

export async function loadBotState(sessionId) {
    try {
        const sessionStateFile = path.join(DATA_DIR, `bot-state-${sessionId}.json`);
        if (fs.existsSync(sessionStateFile)) {
            const data = fs.readFileSync(sessionStateFile, 'utf8');
            const loadedState = JSON.parse(data);

            // Merge with default state to ensure all properties exist
            return { ...defaultBotState, ...loadedState };
        }
    } catch (error) {
        console.error('Error loading bot state:', error);
    }

    // Return default state if no saved state exists
    return { ...defaultBotState };
}