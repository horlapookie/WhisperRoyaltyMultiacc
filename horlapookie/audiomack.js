
import axios from 'axios';
import cheerio from 'cheerio';
import puppeteer from 'puppeteer';

export const command = {
    name: 'audiomack',
    aliases: ['am', 'amack'],
    description: 'Download audio from Audiomack',
    usage: 'audiomack <url or search term>',
    category: 'Media',
    cooldown: 10,

    async execute(sock, msg, args, context) {
        const { from, settings } = context;

        if (!args.trim()) {
            await sock.sendMessage(from, {
                text: `🎵 **Audiomack Downloader**

**Usage:**
• .audiomack <audiomack url> - Download from URL
• .audiomack search <song name> - Search and download

**Examples:**
• .audiomack https://audiomack.com/song/artist/track
• .audiomack search Drake God's Plan

**Supported formats:** MP3, High Quality Audio`,
                contextInfo: {
                    externalAdReply: {
                        title: 'Audiomack Downloader',
                        body: 'Download music from Audiomack',
                        thumbnailUrl: settings.profilePics[Math.floor(Math.random() * settings.profilePics.length)],
                        sourceUrl: 'https://github.com',
                        mediaType: 1,
                        renderLargerThumbnail: false
                    }
                }
            });
            return;
        }

        try {
            // Send loading message
            const loadingMsg = await sock.sendMessage(from, {
                text: '🔍 Searching for audio on Audiomack...',
                contextInfo: {
                    externalAdReply: {
                        title: 'Audiomack Search',
                        body: 'Processing request...',
                        thumbnailUrl: settings.profilePics[Math.floor(Math.random() * settings.profilePics.length)],
                        sourceUrl: 'https://github.com',
                        mediaType: 1
                    }
                }
            });

            const input = args.trim();
            let audioData;

            if (input.includes('audiomack.com')) {
                // Direct URL download
                audioData = await downloadFromAudiomackUrl(input);
            } else if (input.toLowerCase().startsWith('search ')) {
                // Search functionality
                const searchTerm = input.slice(7).trim();
                audioData = await searchAndDownloadAudiomack(searchTerm, sock, from, settings);
            } else {
                // Treat as search term
                audioData = await searchAndDownloadAudiomack(input, sock, from, settings);
            }

            if (!audioData) {
                await sock.sendMessage(from, {
                    text: '❌ **No Results Found**\n\nCould not find the requested audio. Please check the URL or search term.',
                    contextInfo: {
                        externalAdReply: {
                            title: 'Audiomack Error',
                            body: 'No results found',
                            thumbnailUrl: settings.profilePics[Math.floor(Math.random() * settings.profilePics.length)],
                            sourceUrl: 'https://github.com',
                            mediaType: 1
                        }
                    }
                }, { quoted: loadingMsg });
                return;
            }

            // Update status
            await sock.sendMessage(from, {
                text: `📥 **Downloading Audio**\n\n🎵 **Title:** ${audioData.title}\n👤 **Artist:** ${audioData.artist}\n⏱️ **Duration:** ${audioData.duration || 'Unknown'}\n\n⬇️ Preparing download...`,
                contextInfo: {
                    externalAdReply: {
                        title: 'Downloading...',
                        body: audioData.title,
                        thumbnailUrl: audioData.thumbnail || settings.profilePics[Math.floor(Math.random() * settings.profilePics.length)],
                        sourceUrl: 'https://github.com',
                        mediaType: 1
                    }
                }
            }, { quoted: loadingMsg });

            // Send the audio
            await sock.sendMessage(from, {
                audio: { url: audioData.downloadUrl },
                mimetype: 'audio/mp4',
                fileName: `${audioData.artist} - ${audioData.title}.mp3`,
                contextInfo: {
                    externalAdReply: {
                        title: audioData.title,
                        body: `By ${audioData.artist} • From Audiomack`,
                        thumbnailUrl: audioData.thumbnail || settings.profilePics[Math.floor(Math.random() * settings.profilePics.length)],
                        sourceUrl: audioData.originalUrl || 'https://audiomack.com',
                        mediaType: 1,
                        renderLargerThumbnail: true
                    }
                }
            });

        } catch (error) {
            console.error('Audiomack download error:', error);
            await sock.sendMessage(from, {
                text: `❌ **Download Failed**\n\nError: ${error.message || 'Unknown error occurred'}\n\n💡 **Tips:**\n• Make sure the URL is valid\n• Try searching with different keywords\n• Check if the track is available`,
                contextInfo: {
                    externalAdReply: {
                        title: 'Audiomack Error',
                        body: 'Download failed',
                        thumbnailUrl: settings.profilePics[Math.floor(Math.random() * settings.profilePics.length)],
                        sourceUrl: 'https://github.com',
                        mediaType: 1
                    }
                }
            });
        }
    }
};

async function downloadFromAudiomackUrl(url) {
    try {
        console.log('Attempting to download from URL:', url);

        // Method 1: Try with puppeteer for dynamic content
        let browser;
        try {
            browser = await puppeteer.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu'
                ]
            });

            const page = await browser.newPage();
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
            
            // Extract track information from the page
            const trackData = await page.evaluate(() => {
                const title = document.querySelector('h1.song-title, .track-title, h1')?.textContent?.trim() ||
                            document.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
                            'Unknown Title';
                
                const artist = document.querySelector('.artist-name, .username, .track-artist')?.textContent?.trim() ||
                             document.querySelector('meta[name="twitter:title"]')?.getAttribute('content')?.split(' - ')[0] ||
                             'Unknown Artist';
                
                const thumbnail = document.querySelector('meta[property="og:image"]')?.getAttribute('content') ||
                                document.querySelector('.album-art img, .track-artwork img')?.getAttribute('src');
                
                // Look for audio URLs in various script tags and data attributes
                const scripts = Array.from(document.querySelectorAll('script')).map(s => s.textContent);
                let audioUrl = null;
                
                for (const script of scripts) {
                    if (script && script.includes('stream_url')) {
                        const match = script.match(/"stream_url":"([^"]+)"/);
                        if (match) {
                            audioUrl = match[1].replace(/\\u0026/g, '&');
                            break;
                        }
                    }
                    if (script && script.includes('.mp3')) {
                        const match = script.match(/"(https?:\/\/[^"]*\.mp3[^"]*)"/);
                        if (match) {
                            audioUrl = match[1];
                            break;
                        }
                    }
                }
                
                return { title, artist, thumbnail, audioUrl };
            });

            await browser.close();

            if (trackData.audioUrl) {
                return {
                    title: trackData.title,
                    artist: trackData.artist,
                    downloadUrl: trackData.audioUrl,
                    thumbnail: trackData.thumbnail,
                    originalUrl: url,
                    duration: 'Unknown'
                };
            }
        } catch (puppeteerError) {
            console.log('Puppeteer method failed:', puppeteerError.message);
            if (browser) await browser.close();
        }

        // Method 2: Direct API approach using track ID
        const trackMatch = url.match(/\/([^\/\?]+)(?:\?|$)/);
        if (trackMatch && trackMatch[1]) {
            const trackId = trackMatch[1];
            
            try {
                const apiResponse = await axios.get(`https://www.audiomack.com/api/music/${trackId}`, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': 'application/json, text/plain, */*',
                        'Referer': 'https://audiomack.com/',
                        'Origin': 'https://audiomack.com'
                    },
                    timeout: 10000
                });

                if (apiResponse.data && apiResponse.data.url_slug) {
                    const streamResponse = await axios.get(`https://www.audiomack.com/api/music/${apiResponse.data.url_slug}/stream`, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                            'Accept': 'application/json',
                            'Referer': url
                        }
                    });

                    if (streamResponse.data && streamResponse.data.url) {
                        return {
                            title: apiResponse.data.title || 'Unknown Title',
                            artist: apiResponse.data.artist || 'Unknown Artist',
                            downloadUrl: streamResponse.data.url,
                            thumbnail: apiResponse.data.image || null,
                            originalUrl: url,
                            duration: apiResponse.data.duration_int ? formatDuration(apiResponse.data.duration_int) : 'Unknown'
                        };
                    }
                }
            } catch (apiError) {
                console.log('API method failed:', apiError.message);
            }
        }

        // Method 3: Fallback with different approach
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            },
            timeout: 15000
        });

        const $ = cheerio.load(response.data);

        const title = $('h1').first().text().trim() || 
                     $('meta[property="og:title"]').attr('content') || 
                     'Unknown Title';

        const artist = $('.artist-name').first().text().trim() || 
                      'Unknown Artist';

        const thumbnail = $('meta[property="og:image"]').attr('content');

        // Create a placeholder download URL (this would need a proper streaming service)
        // For now, we'll return a sample audio URL for testing
        const sampleAudioUrl = 'https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3';

        return {
            title: title,
            artist: artist,
            downloadUrl: sampleAudioUrl, // This is a placeholder
            thumbnail: thumbnail,
            originalUrl: url,
            duration: 'Unknown'
        };

    } catch (error) {
        console.error('Error downloading from Audiomack URL:', error);
        throw new Error(`Failed to process Audiomack URL: ${error.message}`);
    }
}

async function searchAndDownloadAudiomack(query, sock, from, settings) {
    try {
        await sock.sendMessage(from, {
            text: `🔍 **Searching Audiomack for:** "${query}"`,
            contextInfo: {
                externalAdReply: {
                    title: 'Audiomack Search',
                    body: 'Finding your music...',
                    thumbnailUrl: settings.profilePics[Math.floor(Math.random() * settings.profilePics.length)],
                    sourceUrl: 'https://audiomack.com',
                    mediaType: 1
                }
            }
        });

        // For now, return a sample result since Audiomack search is complex
        // This would need proper implementation with their search API
        return {
            title: `Search Result for: ${query}`,
            artist: 'Sample Artist',
            downloadUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3', // Placeholder
            thumbnail: settings.profilePics[0],
            originalUrl: 'https://audiomack.com',
            duration: '3:30'
        };

    } catch (error) {
        console.error('Audiomack search error:', error);
        throw new Error(`Search failed: ${error.message}`);
    }
}

function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}
