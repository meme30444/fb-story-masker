const { Telegraf } = require('telegraf');
const express = require('express');
const axios = require('axios');

const BOT_TOKEN = process.env.BOT_TOKEN;
const PORT = process.env.PORT || 3000;

const SIGNATURE = "\n\n---\n👉 *Follow for the next part! (Link in comments)*";

// ENHANCED DICTIONARY - ENSURING DOUBLE SYMBOLS
const dictionary = {
    'massage': 'ma$$age',
    'pussy': 'pu$$y',
    'tits': 't*ts',
    'tit': 't*t',
    'sex': 's*x', 'sexy': 's3xy', 'nude': 'n*de', 'naked': 'n@ked', 'porn': 'p*rn',
    'dick': 'd*ck', 'cock': 'c0ck', 'vagina': 'v@gina', 'penis': 'p3nis',
    'orgasm': 'org@sm', 'clit': 'cl*t', 'ejaculate': 'ej@culate', 'condom': 'c0ndom',
    'erotic': 'er0tic', 'hentai': 'h3ntai', 'milf': 'm*lf', 'sperm': 'sp3rm',
    'boobs': 'bo0b$', 'boob': 'bo0b', 'breast': 'br3ast', 'nipple': 'n*pple', 'butt': 'bu++',
    'bra': 'br@', 'panties': 'p@nties', 'lingerie': 'ling3rie', 'threesome': '3some',
    'orgies': 'orgi3s', 'orgy': 'orgi3', 'masturbate': 'm@sturbate', 'cum': 'c*m', 
    'cumming': 'c*mming', 'balls': 'b@lls', 'ass': '@ss',
    'kill': 'k*ll', 'dead': 'd3ad', 'death': 'd3ath', 'murder': 'm*rder', 'blood': 'bl00d',
    'suicide': 'sui-cide', 'rape': 'r@pe', 'torture': 't0rture', 'stab': 'st@b',
    'shoot': 'sh00t', 'bullet': 'b*llet', 'strangle': 'str@ngle', 'corpse': 'c0rpse', 
    'gun': 'g*n', 'weapon': 'we@pon', 'fuck': 'f*ck', 'fucking': 'f*ckin', 'bitch': 'bi+ch', 
    'shit': 'sh*t', 'asshole': 'a$$hole', 'bastard': 'b@stard', 'cunt': 'c*nt', 'slut': 'sl*t', 
    'whore': 'wh0re', 'motherfucker': 'mofo', 'kiss': 'ki$$', 'kissing': 'ki$$ing', 
    'bedroom': 'b3droom', 'bed': 'b-e-d', 'moan': 'm0an', 'tongue': 't0ngue', 'nakedness': 'n@kedness', 
    'naughty': 'n@ughty', 'desire': 'des*re', '18+': 'one-eight+'
};

const userSessions = {};
const bot = new Telegraf(BOT_TOKEN);
const app = express();

app.get('/', (req, res) => res.send('Bot Active'));
app.listen(PORT, () => console.log(`Server on ${PORT}`));

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function maskText(text) {
    let result = text;
    // Sort words by length descending
    const sortedWords = Object.keys(dictionary).sort((a, b) => b.length - a.length);
    for (const word of sortedWords) {
        const regex = new RegExp(word, 'gi'); // Removed \b for more aggressive matching
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
        statusMsg = await ctx.reply("⏳ Processing... Analyzing and masking text (approx 5-10s)");
        await sleep(5000); // Wait for Telegram to finish delivering all parts
        
        const censored = maskText(rawText);
        const parts = splitByParagraphs(censored);
        
        // Delete the status message once we start sending
        try { await ctx.deleteMessage(statusMsg.message_id); } catch (e) {}

        for (let i = 0; i < parts.length; i++) {
            const label = parts.length > 1 ? `📖 *PART ${i + 1}*\n\n` : "";
            try {
                await ctx.reply(label + parts[i] + SIGNATURE, { parse_mode: 'Markdown' });
            } catch (err) {
                await ctx.reply(label + parts[i] + SIGNATURE);
            }
            // 2 second delay to ensure Telegram maintains message order
            await sleep(2000); 
        }
    } catch (e) {
        if (statusMsg) try { await ctx.deleteMessage(statusMsg.message_id); } catch (ex) {}
        ctx.reply("❌ Error processing story.");
    }
}

bot.start((ctx) => {
    ctx.reply('✅ Bot Online! Send me your story directly, or use /start_story to combine multiple pastes.');
});

bot.command('start_story', (ctx) => {
    userSessions[ctx.from.id] = "";
    ctx.reply('📥 Collection Mode ON. Paste your chunks. When done, send /end_story');
});

bot.command('end_story', async (ctx) => {
    const userId = ctx.from.id;
    if (!userSessions[userId]) return ctx.reply("Buffer is empty!");
    await processAndSend(ctx, userSessions[userId]);
    delete userSessions[userId];
});

bot.on('document', async (ctx) => {
    try {
        const fileLink = await ctx.telegram.getFileLink(ctx.message.document.file_id);
        const response = await axios.get(fileLink.href, { responseType: 'arraybuffer' });
        const text = Buffer.from(response.data, 'utf-8').toString();
        await processAndSend(ctx, text);
    } catch (err) {
        ctx.reply("❌ Failed to read file.");
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
