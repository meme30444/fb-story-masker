const { Telegraf } = require('telegraf');
const express = require('express');
const axios = require('axios');

const BOT_TOKEN = process.env.BOT_TOKEN;
const PORT = process.env.PORT || 3000;

const SIGNATURE = "\n\n---\n👉 *Follow for the next part! (Link in comments)*";

// --- FIXED & EXPANDED DICTIONARY ---
const dictionary = {
    // Sexual / Nudity (Fixed your specific flags)
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

    // Violence / Gore
    'kill': 'k*ll', 'dead': 'd3ad', 'death': 'd3ath', 'murder': 'm*rder', 'blood': 'bl00d',
    'suicide': 'sui-cide', 'rape': 'r@pe', 'torture': 't0rture', 'stab': 'st@b',
    'shoot': 'sh00t', 'bullet': 'b*llet', 'strangle': 'str@ngle', 'corpse': 'c0rpse', 
    'gun': 'g*n', 'weapon': 'we@pon',

    // Profanity
    'fuck': 'f*ck', 'fucking': 'f*ckin', 'bitch': 'bi+ch', 'shit': 'sh*t', 'asshole': 'a$$hole',
    'bastard': 'b@stard', 'cunt': 'c*nt', 'slut': 'sl*t', 'whore': 'wh0re', 'motherfucker': 'mofo',

    // Romance / Sensitive
    'kiss': 'ki$$', 'kissing': 'ki$$ing', 'bedroom': 'b3droom', 'bed': 'b-e-d', 'moan': 'm0an',
    'tongue': 't0ngue', 'nakedness': 'n@kedness', 'naughty': 'n@ughty', 'desire': 'des*re',
    'massage': 'ma$$age', '18+': 'one-eight+'
};

const userSessions = {};
const bot = new Telegraf(BOT_TOKEN);
const app = express();

app.get('/', (req, res) => res.send('Bot Active'));
app.listen(PORT, () => console.log(`Server on ${PORT}`));

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function maskText(text) {
    let result = text;
    // Sort words by length so 'fucking' is caught before 'fuck'
    const sortedWords = Object.keys(dictionary).sort((a, b) => b.length - a.length);
    for (const word of sortedWords) {
        // Use word boundaries \b to ensure we don't accidentally mask parts of normal words
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
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
    try {
        await ctx.reply("⏳ Processing... Analyzing and masking text.");
        // Deliberate 5-second wait to ensure all chunks are settled and processed
        await sleep(5000); 
        
        const censored = maskText(rawText);
        const parts = splitByParagraphs(censored);
        
        for (let i = 0; i < parts.length; i++) {
            const label = parts.length > 1 ? `📖 *PART ${i + 1}*\n\n` : "";
            try {
                // Try sending with Markdown
                await ctx.reply(label + parts[i] + SIGNATURE, { parse_mode: 'Markdown' });
            } catch (err) {
                // Fallback to plain text if a story character breaks Markdown
                await ctx.reply(label + parts[i] + SIGNATURE);
            }
            await sleep(1500); // 1.5s delay between parts to prevent flood errors
        }
    } catch (e) {
        console.error(e);
        ctx.reply("❌ Error processing this story.");
    }
}

bot.command('start_story', (ctx) => {
    userSessions[ctx.from.id] = "";
    ctx.reply('📥 Collection Mode ON. Paste your chunks one by one. When done, send /end_story');
});

bot.command('end_story', async (ctx) => {
    const userId = ctx.from.id;
    if (!userSessions[userId]) return ctx.reply("Buffer is empty!");
    await processAndSend(ctx, userSessions[userId]);
    delete userSessions[userId];
});

// DOCUMENT HANDLER (.txt files)
bot.on('document', async (ctx) => {
    try {
        const fileLink = await ctx.telegram.getFileLink(ctx.message.document.file_id);
        // Force responseType to 'text' to handle files correctly
        const response = await axios.get(fileLink.href, { responseType: 'text' });
        ctx.reply("📄 File received. Starting process...");
        await processAndSend(ctx, response.data);
    } catch (err) {
        console.error(err);
        ctx.reply("❌ Failed to read .txt file.");
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
