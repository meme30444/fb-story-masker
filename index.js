const { Telegraf } = require('telegraf');
const express = require('express');
const axios = require('axios');

const BOT_TOKEN = process.env.BOT_TOKEN;
const PORT = process.env.PORT || 3000;

const SIGNATURE = "\n\n---\n👉 *Follow for the more!*";

const dictionary = {
    // Priority Sexual/Sensitive (Ensuring double $$)
    'massage': 'ma$$age',
    'pussy': 'pu$$y',
    'kisses': 'ki$$es',
    'kissing': 'ki$$ing',
    'kiss': 'ki$$',
    'tits': 't*ts',
    'tit': 't*t',
    
    // Nudity/Sex
    'sex': 's*x', 'sexy': 's3xy', 'nude': 'n*de', 'naked': 'n@ked', 'porn': 'p*rn',
    'dick': 'd*ck', 'cock': 'c0ck', 'vagina': 'v@gina', 'penis': 'p3nis',
    'orgasm': 'org@sm', 'clit': 'cl*t', 'ejaculate': 'ej@culate', 'condom': 'c0ndom',
    'erotic': 'er0tic', 'hentai': 'h3ntai', 'milf': 'm*lf', 'sperm': 'sp3rm',
    'boobs': 'bo0b$', 'boob': 'bo0b', 'breast': 'br3ast', 'nipple': 'n*pple', 'butt': 'bu++',
    'bra': 'br@', 'panties': 'p@nties', 'lingerie': 'ling3rie', 'threesome': '3some',
    'orgies': 'orgi3s', 'orgy': 'orgi3', 'masturbate': 'm@sturbate', 'cum': 'c*m', 
    'cumming': 'c*mming', 'balls': 'b@lls', 'ass': '@ss',

    // Violence
    'kill': 'k*ll', 'dead': 'd3ad', 'death': 'd3ath', 'murder': 'm*rder', 'blood': 'bl00d',
    'suicide': 'sui-cide', 'rape': 'r@pe', 'torture': 't0rture', 'stab': 'st@b',
    'shoot': 'sh00t', 'bullet': 'b*llet', 'strangle': 'str@ngle', 'corpse': 'c0rpse', 
    'gun': 'g*n', 'weapon': 'we@pon',

    // Profanity
    'fuck': 'f*ck', 'fucking': 'f*ckin', 'bitch': 'bi+ch', 'shit': 'sh*t', 'asshole': 'a$$hole',
    'bastard': 'b@stard', 'cunt': 'c*nt', 'slut': 'sl*t', 'whore': 'wh0re', 'motherfucker': 'mofo',
    'bedroom': 'b3droom', 'bed': 'b-e-d', 'moan': 'm0an', 'tongue': 't0ngue', 'nakedness': 'n@kedness', 
    'naughty': 'n@ughty', 'desire': 'des*re'
};

const userSessions = {};
const bot = new Telegraf(BOT_TOKEN);
const app = express();

app.get('/', (req, res) => res.send('Bot Active'));
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function maskText(text) {
    let result = text;
    // We sort by length so "kissing" is masked before "kiss"
    const sortedKeys = Object.keys(dictionary).sort((a, b) => b.length - a.length);
    
    for (const word of sortedKeys) {
        // Simple case-insensitive global replacement
        const regex = new RegExp(word, 'gi');
        result = result.replace(regex, dictionary[word]);
    }
    return result;
}

function splitByParagraphs(text, limit = 8000) {
    const paragraphs = text.split('\n');
    const parts = [];
    let currentPart = "";
    for (let para of paragraphs) {
        if ((currentPart + para).length > limit) {
            parts.push(currentPart.trim());
            currentPart = para + "\n";
        } else {
            currentPart += para + "\n";
        }
    }
    if (currentPart) parts.push(currentPart.trim());
    return parts;
}

async function processAndSend(ctx, rawText) {
    let statusMsg;
    try {
        statusMsg = await ctx.reply("⏳ **Step 1: Analyzing and Masking Story...**");
        
        // Final cleaning and splitting
        const censored = maskText(rawText);
        const parts = splitByParagraphs(censored);
        
        await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, null, `⏳ **Step 2: Sending ${parts.length} Parts in order...**`);

        for (let i = 0; i < parts.length; i++) {
            const label = parts.length > 1 ? `📖 *PART ${i + 1} OF ${parts.length}*\n\n` : "";
            try {
                await ctx.reply(label + parts[i] + SIGNATURE, { parse_mode: 'Markdown' });
            } catch (err) {
                // If Markdown fails (symbols like [ or _), send as plain text
                await ctx.reply(label + parts[i] + SIGNATURE);
            }
            // 3 second delay is the "Sweet Spot" for Telegram order consistency
            await sleep(3000); 
        }

        // Final cleanup and completion alert
        try { await ctx.deleteMessage(statusMsg.message_id); } catch (e) {}
        await ctx.reply("✅ **TASK COMPLETE.**\nYou can now paste another story or upload a .txt file.");

    } catch (e) {
        console.error(e);
        ctx.reply("❌ Error processing your story. It might be too large or have weird characters.");
    }
}

// Handlers
bot.start((ctx) => {
    ctx.reply('✅ **FB Story Masker is Online!**\n\n1. Paste a story directly.\n2. Use /start_story for multiple pastes.\n3. Send a .txt file.');
});

bot.command('start_story', (ctx) => {
    userSessions[ctx.from.id] = "";
    ctx.reply('📥 **Collection Mode ON.**\nPaste your chunks now. When you have sent everything, send /end_story');
});

bot.command('end_story', async (ctx) => {
    const userId = ctx.from.id;
    if (!userSessions[userId]) return ctx.reply("❌ Nothing in the buffer! Paste some text first.");
    await processAndSend(ctx, userSessions[userId]);
    delete userSessions[userId];
});

bot.on('document', async (ctx) => {
    try {
        const fileLink = await ctx.telegram.getFileLink(ctx.message.document.file_id);
        // Better file reading: responseType 'arraybuffer' is the safest for all server types
        const response = await axios.get(fileLink.href, { responseType: 'arraybuffer' });
        const textData = Buffer.from(response.data).toString('utf-8');
        
        await ctx.reply("📄 **File received.** Reading content...");
        await processAndSend(ctx, textData);
    } catch (err) {
        console.error(err);
        ctx.reply("❌ Failed to read that file. Ensure it is a standard .txt file.");
    }
});

bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    const text = ctx.message.text;
    if (text.startsWith('/')) return;

    if (userSessions[userId] !== undefined) {
        userSessions[userId] += text + "\n";
        return; 
    }
    await processAndSend(ctx, text);
});

bot.launch();
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
