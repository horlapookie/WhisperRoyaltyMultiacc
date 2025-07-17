# 🤖 WhisperRoyalty - Advanced Multi-Session WhatsApp Bot v1.0

<div align="center">

[![GitHub Stars](https://img.shields.io/github/stars/horlapookie/WhisperRoyalty?style=for-the-badge&logo=github&color=gold)](https://github.com/horlapookie/WhisperRoyalty/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/horlapookie/WhisperRoyalty?style=for-the-badge&logo=github&color=blue)](https://github.com/horlapookie/WhisperRoyalty/network)
[![License](https://img.shields.io/github/license/horlapookie/WhisperRoyalty?style=for-the-badge&color=green)](https://github.com/horlapookie/WhisperRoyalty/blob/main/LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-v18+-green?style=for-the-badge&logo=node.js)](https://nodejs.org/)
[![Multi-Session](https://img.shields.io/badge/Multi--Session-Support-orange?style=for-the-badge)](https://github.com/horlapookie/WhisperRoyalty)

**⚡ Advanced Multi-Session WhatsApp Bot with AI Integration & Pokemon Battle System**

[📖 Documentation](#-documentation) • [🚀 Quick Start](#-quick-start) • [🎮 Features](#-features) • [💡 Support](#-support)

</div>

---

## 🌟 **What Makes WhisperRoyalty Special?**

WhisperRoyalty is the **ultimate multi-session WhatsApp bot ecosystem** with cutting-edge features:

- 🔥 **Multi-Session Support** - Run up to 15 WhatsApp sessions simultaneously
- 🧠 **AI-Powered Intelligence** - Gemini AI integration for smart conversations
- ⚔️ **Epic Pokemon Universe** - Complete battle system with 4v4 strategic gameplay
- 🛡️ **Ethical Hacking Toolkit** - Educational cybersecurity tools
- 🎵 **Media Powerhouse** - Download music, videos, and social content
- 🎮 **Interactive Gaming** - Chess, trivia, hangman, and more
- 📊 **Utility Arsenal** - 140+ commands for productivity
- 👥 **Advanced Group Management** - Comprehensive moderation tools
- 📢 **Broadcast System** - Send messages to all contacts with exclusion support
- 🔧 **Auto Session Management** - Intelligent session monitoring and recovery

---

## 🚀 **Quick Start**

### **Prerequisites**
- Node.js v18+ installed
- WhatsApp account(s) for each session
- Gemini API key (free from Google AI Studio)

### **Installation**

1. **Clone & Setup**
   ```bash
   git clone https://github.com/horlapookie/WhisperRoyalty.git
   cd WhisperRoyalty
   npm install
   ```

2. **Configure Multi-Session Settings**
   ```javascript
   // Edit settings.js
   export const settings = {
       sessions: [
           {
               id: "session1",
               ownerNumber: "2347049044897@s.whatsapp.net",
               sessionBase64: "YOUR_SESSION_DATA_1",
               enabled: true
           },
           {
               id: "session2", 
               ownerNumber: "2348142310854@s.whatsapp.net",
               sessionBase64: "YOUR_SESSION_DATA_2",
               enabled: true
           }
           // Add up to 15 sessions
       ],
       geminiApiKey: "YOUR_GEMINI_API_KEY",
       prefix: ".",
       botName: "yourhïghness"
   };
   ```

3. **Command Prefixes**
   - `.` - Regular commands (e.g., `.help`, `.ai`, `.music`)
   - `=>` - GitHub repository updates (Creator only)
   - `$` - Terminal/bash commands (Creator only)

4. **Get Session Data**
   - Message: wa.me/2349122222622?text=session+loading+link+for+your+bot
   - Scan QR code with your WhatsApp for each session
   - Copy the session data to corresponding session in `settings.js`

5. **Launch Multi-Session Bot**
   ```bash
   npm install
   npm start
   ```

### **Deployment on Any Platform**

The bot is now unified into a single `index.js` file for easy deployment:

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the bot:**
   ```bash
   npm start
   ```

3. **Health Check:**
   - The bot includes a health check endpoint at `/health`
   - Accessible on PORT environment variable (defaults to 5000)
   - Returns session status and uptime information

4. **Environment Variables:**
   - `PORT` - Health check server port (optional, defaults to 5000)
   - `NODE_ENV` - Environment mode (optional)
   ```

6. **Success!** 🎉
   ```
   ✅ Session session1 connected successfully!
   ✅ Session session2 connected successfully!
   📨 Connection notifications sent to owners
   🤖 Multi-session bot is now running...
   ```

---

## 🎮 **Core Features**

### 🔥 **Multi-Session Management**
| Command | Description | Access |
|---------|-------------|--------|
| `.sessions list` | View all session statuses | Creator only |
| `.sessions start <id>` | Start specific session | Creator only |
| `.sessions stop <id>` | Stop specific session | Creator only |
| `.sessions restart <id>` | Restart session | Creator only |
| `.sessions broadcast <msg>` | Broadcast to all sessions | Creator only |

### 🧠 **AI & Machine Learning**
| Command | Description | Example |
|---------|-------------|---------|
| `.ai <question>` | Chat with Gemini AI | `.ai What is quantum computing?` |
| `.translate <text> \| <lang>` | Multi-language translation | `.translate Hello \| Spanish` |
| `.img <prompt>` | AI image generation | `.img sunset over mountains` |
| `.aicontext` | Set AI conversation context | `.aicontext You are a helpful assistant` |

### ⚔️ **Pokemon Battle System**
| Command | Description | Usage |
|---------|-------------|-------|
| `.spawnpokemon` | Spawn wild Pokemon | Auto-spawning system |
| `.catch` | Catch spawned Pokemon | Quick-time catching |
| `.pvp challenge @user` | Challenge to 4v4 battle | Strategic team battles |
| `.pvp party` | Manage battle team | View active Pokemon |
| `.pokedex` | View collection | Complete Pokemon stats |
| `.pokeballs` | Check pokeball inventory | Daily claims available |

### 🎵 **Media & Entertainment**
| Feature | Commands | Capabilities |
|---------|----------|--------------|
| **Music** | `.music <song>`, `.lyrics <song>` | MP3 download, lyrics search |
| **Video** | `.yt <url>`, `.tiktok <url>` | YouTube/TikTok download |
| **Social** | `.instagram <url>`, `.twitter <url>` | Social media content |

### 🛡️ **Ethical Hacking (Educational)**
| Tool | Command | Purpose |
|------|---------|---------|
| **Network** | `.nmap <target>` | Port scanning info |
| **DNS** | `.dns <domain>` | Domain analysis |
| **Security** | `.whois <domain>` | Registration details |
| **Analysis** | `.headers <url>` | HTTP security headers |

### 🎮 **Interactive Games**
- ♟️ **Chess** - Full board game with notation
- 🎯 **Trivia** - Multi-category questions
- 🎪 **Hangman** - Word guessing with hints
- 🎲 **Dice Games** - Custom dice rolling
- 🃏 **8Ball** - Magic 8-ball predictions
- 🎰 **Gambling** - Slot machines and betting

---

## 👑 **Owner Commands**

### **General Bot Control**
```bash
.on/.off          # Bot power control
.public/.private   # Access mode switching
.autoview on/off   # Status auto-viewing
.autoreact on/off  # Auto-emoji reactions
.chatbot on/off    # DM AI responses
.block/.unblock    # WhatsApp contact blocking
.ban/.unban        # Bot user management
.autodel on/off    # Deleted message alerts
.restart          # Restart bot and resend connection message
.save             # Save status/media and send to private chat
```

### **Advanced Owner Features**
```bash
=>gitupdate       # Update bot from GitHub repository
$ls               # Execute terminal commands (bash)
.broadcast <msg>  # Send message to all contacts
.broadcast <msg> <phone1> <phone2>  # Broadcast with exclusions
```

### **Creator-Only Commands**
```bash
.sessions list           # View all session statuses
.sessions start <id>     # Start specific session
.sessions stop <id>      # Stop specific session
.sessions restart <id>   # Restart session
.sessions broadcast <msg> # Broadcast to all sessions
```

---

## 📢 **Broadcast System**

Advanced broadcasting with exclusion support:

### **Basic Broadcast**
```bash
.broadcast Hello everyone!
```

### **Broadcast with Exclusions**
```bash
.broadcast Important announcement! +1234567890 +0987654321
```

### **Reply-Based Broadcast**
```bash
# Reply to any message with:
.broadcast
# or with exclusions:
.broadcast +1234567890 +0987654321
```

**Features:**
- 📱 Send to all WhatsApp contacts
- 🚫 Exclude up to 10 phone numbers
- 📊 Real-time progress tracking
- ✅ Delivery confirmation reports
- 🔄 Auto-retry failed sends

---

## 📊 **Advanced Features**

### 🛡️ **Security & Protection**
- ⚡ **Anti-Spam System** - Rate limiting & cooldowns
- 🔒 **Multi-Level Access Control** - Creator, Owner, Public permissions
- 🛡️ **Error Handling** - Graceful failure recovery
- 📝 **Audit Logging** - Complete activity tracking
- 🔄 **Auto Session Recovery** - Intelligent reconnection

### 🤖 **AI Integration**
- 💬 **Smart DM Chatbot** - Context-aware responses
- 🌐 **Multi-Language Support** - 100+ languages
- 🎨 **Image Generation** - AI-powered artwork
- 📊 **Data Analysis** - Intelligent insights
- 🧠 **Conversation Memory** - Persistent chat context

### 👥 **Group Management**
- 🏷️ **Smart Tagging** - Mention all members with proper @ formatting
- 📊 **Polls & Surveys** - Interactive group decisions
- 🗑️ **Message Management** - Selective deletion
- ⚖️ **Team Formation** - Automatic group splitting
- 📈 **Group Analytics** - Activity insights

### 🔧 **Multi-Session Architecture**
- 🌐 **15 Concurrent Sessions** - Maximum scalability
- 🔄 **Auto Session Management** - Smart monitoring
- 📊 **Session Health Monitoring** - Real-time status
- 🚫 **Auto-Disable Failed Sessions** - Prevents resource waste
- 📝 **Dynamic Configuration** - Runtime session updates

---

## 🎯 **Usage Examples**

### **Multi-Session Management**
```bash
# View all sessions
.sessions list

# Start specific session
.sessions start session3

# Broadcast to all sessions
.sessions broadcast Server maintenance in 10 minutes
```

### **Pokemon Battles**
```bash
# Start your Pokemon journey
.spawnpokemon              # Wild Pokemon appears
.catch                     # Catch the Pokemon
.pvp transfer2party 1      # Add to battle team
.pvp challenge @friend     # Challenge someone
.pvp accept               # Accept challenge
.pvp move1                # Use first move
```

### **AI Conversations**
```bash
# Smart AI interactions
.ai How do I code in Python?
.aicontext You are a programming expert
.ai Write a poem about cats
.translate Bonjour | English
.img anime girl with sword
```

### **Advanced Broadcasting**
```bash
# Basic broadcast
.broadcast Important update for everyone!

# Exclude specific numbers
.broadcast Meeting at 3 PM today! +1234567890 +0987654321

# Reply to message and broadcast
# (Reply to any message with .broadcast)
```

### **Group Fun**
```bash
# Interactive group activities
.tagall Time for game night! 🎮    # Tags all members with @
.poll Should we order pizza? Yes|No
.trivia                            # Start quiz game
.chess                            # Begin chess match
.gamble 1000                      # Slot machine betting
```

---

## 📱 **Platform Compatibility**

| Platform | Status | Notes |
|----------|--------|-------|
| 🤖 **Android** | ✅ Full Support | Recommended |
| 🍎 **iOS** | ✅ Full Support | All features work |
| 💻 **Desktop** | ✅ WhatsApp Web | Complete functionality |
| 🌐 **Multi-Device** | ✅ Synced | Cross-platform sync |
| 🔄 **Multi-Session** | ✅ 15 Sessions | Concurrent support |

---

## ⚙️ **Configuration**

### **Basic Configuration**
```javascript
// settings.js
export const settings = {
    // Bot Identity
    botName: "yourhïghness",
    version: "v1.0",
    prefix: ".",

    // Multi-Session Configuration
    sessions: [
        {
            id: "session1",
            ownerNumber: "2347049044897@s.whatsapp.net",
            sessionBase64: "session-1-data-here",
            enabled: true
        },
        {
            id: "session2",
            ownerNumber: "2348142310854@s.whatsapp.net", 
            sessionBase64: "session-2-data-here",
            enabled: true
        }
        // Add up to 15 sessions
    ],

    // API Keys
    geminiApiKey: "your-gemini-api-key",
    openaiApiKey: "your-openai-api-key",

    // Features
    antiSpam: true,
    autoReconnect: true,
    commandCooldown: 3000,

    // Auto Session Management
    maxReconnectAttempts: 3,
    sessionHealthCheck: true,

    // Appearance
    profilePics: [
        "https://files.catbox.moe/mq8b1n.png"
    ]
};
```

### **Session Management**
- Each session operates independently
- Auto-disable failed sessions to save resources
- Real-time session health monitoring
- Dynamic session enable/disable via settings
- Automatic reconnection with exponential backoff

---

## 📈 **Performance Stats**

```
🚀 Command Count: 140+ active commands
⚡ Response Time: <500ms average
🔄 Uptime: 99.9% reliability per session
📊 Multi-language: 100+ languages supported
🛡️ Security: Advanced anti-spam protection
🤖 AI Integration: Gemini-powered responses
🔧 System Control: GitHub integration & terminal access
💾 Auto-save: Status & media preservation
🌐 Multi-Session: Up to 15 concurrent sessions
📢 Broadcasting: Mass messaging with exclusions
⚔️ Pokemon System: 800+ Pokemon with battles
```

---

## 🔧 **Development & Deployment**

### **Local Development**
```bash
# Install dependencies
npm install

# Run single session (development)
node start-bot.js

# Run multi-session (production)
node multi-session-bot.js
```

### **Replit Deployment**
1. Fork this repository on Replit
2. Configure your sessions in `settings.js`
3. Set environment secrets if needed
4. Click "Run" to start all sessions
5. Monitor logs for session status

### **Session Data Management**
- Get session data from: wa.me/2349122222622
- Each session requires separate WhatsApp scanning
- Sessions auto-save and restore state
- Failed sessions automatically disabled

---

## 🤝 **Contributing**

We welcome contributions! Here's how to get started:

1. **⭐ Star this repository** (Required for access)
2. **👤 Follow @horlapookie** on GitHub
3. **🍴 Fork** the repository
4. **🔧 Create** your feature branch
5. **📝 Commit** your changes
6. **📤 Push** to the branch
7. **🔄 Open** a Pull Request

### **Development Guidelines**
- Follow existing code patterns
- Test with multiple sessions
- Add proper documentation
- Update README if needed
- Ensure multi-session compatibility

---

## 📞 **Support & Community**

<div align="center">

### **🆘 Need Help?**

| Support Type | Link | Description |
|--------------|------|-------------|
| 🐛 **Bug Reports** | [GitHub Issues](https://github.com/horlapookie/WhisperRoyalty/issues) | Report bugs & issues |
| 💡 **Feature Requests** | [GitHub Discussions](https://github.com/horlapookie/WhisperRoyalty/discussions) | Suggest new features |
| 📞 **Direct Support** | [WhatsApp](https://wa.me/2349122222622) | Direct developer contact |
| 📚 **Documentation** | [Wiki](https://github.com/horlapookie/WhisperRoyalty/wiki) | Detailed guides |
| 🔧 **Session Setup** | [WhatsApp](https://wa.me/2349122222622?text=session+loading+link) | Get session data |

### **🌟 Show Your Support**

If WhisperRoyalty has helped you, consider:
- ⭐ **Starring** the repository
- 🔄 **Sharing** with friends
- 💰 **Sponsoring** development
- 🤝 **Contributing** code
- 📢 **Spreading** the word

</div>

---

## 📄 **License & Legal**

```
MIT License - Free for personal and commercial use
Copyright (c) 2024 horlapookie

Educational Tools Notice:
All ethical hacking tools are for educational purposes only.
Users are responsible for compliance with local laws.

Multi-Session Notice:
Users are responsible for managing their WhatsApp sessions
according to WhatsApp's Terms of Service.
```

---

<div align="center">

## 🎉 **Ready to Dominate WhatsApp?**

**[⬇️ Download Now](https://github.com/horlapookie/WhisperRoyalty)** • **[📖 View Docs](https://github.com/horlapookie/WhisperRoyalty/wiki)** • **[💬 Get Support](https://wa.me/2349122222622)**

---

*Made with ❤️ by [horlapookie](https://github.com/horlapookie) | Powered by Node.js & WhatsApp Web*

**🔥 WhisperRoyalty - The Ultimate Multi-Session WhatsApp Bot Experience 🔥**

</div>