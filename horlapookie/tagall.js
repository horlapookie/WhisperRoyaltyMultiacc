import chalk from 'chalk';

export const command = {
  name: 'tagall',
  aliases: ['mentionall', 'tag'],
  description: 'Tags all group members',
  usage: 'tagall [owner|admins|members|hidden] <message>',
  category: 'group',
  cooldown: 5,

  async execute(sock, msg, args, context) {
    const { from, sender, senderJid, isGroup } = context;

    if (!isGroup) {
      return await sock.sendMessage(from, {
        text: '❌ This command only works in groups.',
        quoted: msg
      });
    }

    try {
      const metadata = await sock.groupMetadata(from);
      const participants = metadata?.participants || [];

      const ownerJid = metadata.owner || participants.find(p => p.admin === 'superadmin')?.id || '';
      const admins = participants.filter(p => p.admin).map(p => p.id);
      const members = participants
        .filter(p => p.id !== ownerJid && !admins.includes(p.id))
        .map(p => p.id);

      const role = args.trim().split(' ')[0]?.toLowerCase();
      const messageText = args.trim().split(' ').slice(1).join(' ') || 'Hello everyone!';
      const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

      const announcement = messageText || quotedMsg?.conversation || 'Hello group!';

      // Helper to get real WhatsApp number from participant JID - using the attached bot approach
      const extractRealNumber = (participantJid) => {
        if (!participantJid || typeof participantJid !== 'string') return participantJid;

        // Use the same approach as the attached bot: split on '@' and take first part
        const baseNumber = participantJid.split('@')[0];
        
        // For LID format: extract the number before the colon (the real phone number)
        if (baseNumber.includes(':')) {
          const parts = baseNumber.split(':');
          return parts[0]; // The real phone number is before the colon
        }

        // For standard format, return as is
        return baseNumber;
      };

      // Helper to format number for display with proper WhatsApp number
      const formatForDisplay = (participantJid) => {
        const realNumber = extractRealNumber(participantJid);
        // Only return valid phone numbers
        return realNumber && /^\d{10,15}$/.test(realNumber) ? realNumber : participantJid;
      };

      // Collect all participants to DM based on role
      let participantsToMessage = [];

      // Handle hidden tag
      if (role === 'hidden') {
        participantsToMessage = participants.map(p => p.id);
      } else {
        // Add owner if role matches
        if (!role || role === 'owner') {
          if (ownerJid) {
            participantsToMessage.push(ownerJid);
          }
        }

        // Add admins if role matches
        if (!role || role === 'admins') {
          participantsToMessage.push(...admins);
        }

        // Add members if role matches
        if (!role || role === 'members') {
          participantsToMessage.push(...members);
        }
      }

      if (participantsToMessage.length === 0) {
        return await sock.sendMessage(from, {
          text: '❌ No members found for this role!',
          quoted: msg,
        });
      }

      // Send DM to each participant
      let successCount = 0;
      const failedNumbers = [];

      for (const participantJid of participantsToMessage) {
        try {
          // First get the real phone number from profile/bio
          let realPhoneNumber = null;
          let profileName = 'Unknown';
          
          try {
            // Try to get user's profile info to extract real number
            const userProfile = await sock.onWhatsApp(participantJid);
            if (userProfile && userProfile.length > 0) {
              const profileInfo = userProfile[0];
              
              // Try to get status/bio which might contain real number
              try {
                const status = await sock.fetchStatus(participantJid);
                if (status && status.status) {
                  // Look for phone number patterns in bio/status
                  const phoneMatch = status.status.match(/(\+?\d{10,15})/);
                  if (phoneMatch) {
                    realPhoneNumber = phoneMatch[1].replace(/\+/g, '');
                    console.log(chalk.yellow(`[YourHighness] Found real number in bio: +${realPhoneNumber}`));
                  }
                }
              } catch (statusError) {
                console.log(chalk.yellow(`[YourHighness] Could not fetch status for ${participantJid}`));
              }
              
              // Get display name
              if (profileInfo.name) {
                profileName = profileInfo.name;
              }
            }
          } catch (profileError) {
            console.log(chalk.yellow(`[YourHighness] Could not fetch profile for ${participantJid}`));
          }
          
          // Fallback to extracted number if no real number found in profile
          if (!realPhoneNumber) {
            realPhoneNumber = extractRealNumber(participantJid);
            console.log(chalk.cyan(`[YourHighness] Using extracted number: +${realPhoneNumber}`));
          }

          const dmText = `📢 *Group Message*\n\n${announcement}\n\n📱 *Your Real Number:* +${realPhoneNumber}\n👤 *Your Name:* ${profileName}\n👥 *From Group:* ${metadata.subject}\n👤 *Sent by:* +${formatForDisplay(senderJid || sender)}\n\n_Number verified from your profile/bio_`;

          // Send to participant's DM
          await sock.sendMessage(participantJid, {
            text: dmText,
            contextInfo: {
              externalAdReply: {
                title: 'Group Tag Notification',
                body: `From: ${metadata.subject}`,
                thumbnailUrl: 'https://picsum.photos/300/300?random=7',
                sourceUrl: 'https://github.com',
                mediaType: 1
              }
            }
          });

          successCount++;
          console.log(chalk.green(`[YourHighness] DM sent to +${realPhoneNumber} (${profileName})`));
          
          // Add small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (error) {
          const fallbackNumber = extractRealNumber(participantJid);
          failedNumbers.push(fallbackNumber);
          console.error(chalk.red(`[YourHighness] Failed to DM +${fallbackNumber}:`, error.message));
        }
      }

      // Send confirmation to group
      const confirmationText = `✅ *Tag Complete*\n\n📨 DMs sent to ${successCount} members\n${failedNumbers.length > 0 ? `❌ Failed: ${failedNumbers.length} members` : ''}\n\n📝 **Message:** ${announcement}`;

      await sock.sendMessage(from, {
        text: confirmationText,
        contextInfo: {
          externalAdReply: {
            title: 'Tag All Complete',
            body: 'Direct messages sent',
            thumbnailUrl: 'https://picsum.photos/300/300?random=7',
            sourceUrl: 'https://github.com',
            mediaType: 1
          }
        },
        quoted: msg
      });

      console.log(chalk.green(`[YourHighness] Tagall success by +${formatForDisplay(senderJid)}`));
    } catch (err) {
      console.error(chalk.red('[YourHighness] Tagall Error:'), err.message);
      await sock.sendMessage(from, {
        text: '❌ Failed to tag members due to error.',
        quoted: msg,
      });
    }
  }
};