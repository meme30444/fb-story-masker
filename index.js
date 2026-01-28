const { Telegraf } = require('telegraf');
const express = require('express');
const axios = require('axios');

const BOT_TOKEN = process.env.BOT_TOKEN;
const PORT = process.env.PORT || 3000;

const SIGNATURE = "\n\n---\n👉 *Follow for the next part! (Link in comments)*";

// THE COMPLETE DICTIONARY
const dictionary = {
    // Sexual / Nudity
    'sex': 's*x', 'sexy': 's3xy', 'nude': 'n*de', 'naked': 'n@ked', 'porn': 'p*rn',
    'pussy': 'pu$$y', 'dick': 'd*ck', 'cock': 'c0ck', 'vagina': 'v@gina', 'penis': 'p3nis',
    'orgasm': 'org@sm', 'clit': 'cl*t', 'ejaculate': 'ej@culate', 'condom': 'c0ndom',
    'erotic': 'er0tic', 'hentai': 'h3ntai', 'milf': 'm*lf', 'sperm': 'sp3rm',
    'boobs': 'bo0b$', 'boob': 'bo0b', 'breast': 'br3ast', 'nipple': 'n*pple', 'butt': 'bu++',
    'bra': 'br@', 'panties': 'p@nties', 'lingerie': 'ling3rie', 'threesome': '3some',
    'orgies': 'orgi3s', 'orgy': 'orgi3', 'masturbate': 'm@sturbate', 'cum': 'c*m', 
    'cumming': 'c*mming', 'balls': 'b@lls', 'tit': 't*t', 'tits': 't*ts', 'ass': '@ss',

    // Violence / Gore
    'kill': 'k*ll', 'dead': 'd3ad', 'death': 'd3ath', 'murder': 'm*rder', 'blood': 'bl00d',
    'suicide': 'sui-cide', 'rape': 'r@pe', 'torture': 't0rture', 'stab': 'st@b',
    'shoot': 'sh00t', 'bullet': 'b*llet', 'strangle': 'str@ngle', 'corpse': 'c0rpse', 
    'gun': 'g*n', 'weapon': 'we@pon',

    // Profanity
    'fuck': 'f*ck', 'fucking': 'f*ckin', 'bitch': 'bi+ch', 'shit': 'sh*t', 'asshole': 'a$$hole',
    'bastard': 'b@stard', 'cunt': 'c*nt', 'dickhead': 'd*ckhead', 'faggot': 'f@ggot',
    'nigger': 'n-word', 'slut': 'sl*t', 'whore': 'wh0re', 'motherfucker': 'mofo',

    // Romance / Sensitive
    'kiss': 'ki$$', 'kissing': 'ki$$ing', 'bedroom': 'b3droom', 'bed': 'b-e-d', 'moan': 'm0an',
    'tongue': 't0ngue', 'nakedness': 'n@kedness', 'naughty': 'n@ughty', 'desire': 'des*re',
    'massage': 'ma$$age', '18+': 'one-eight+'
};

const userSessions = {};
const bot = new Telegraf(BOT_TOKEN);
const app = express();

app.get('/', (req, res) => res.send('Bot is Healthy'));
app.listen(PORT, () => console.log(`Listening on ${PORT}`));

function maskText(text) {
    let result = text;
    const sortedWords = Object.keys(dictionary).sort((a, b) => b.length - a.length);
    for (const word of sortedWords) {
        const mask = dictionary[word];
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        result = result.replace(regex, mask);
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

// Utility to wait between messages
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function processAndSend(ctx, rawText) {
    try {
        const censored = maskText(rawText);
        const parts = splitByParagraphs(censored);
        
        for (let i = 0; i < parts.length; i++) {
            const label = parts.length > 1 ? `📖 *PART ${i + 1}*\n\n` : "";
            await ctx.reply(label + parts[i] + SIGNATURE, { parse_mode: 'Markdown' });
            await sleep(500); // 0.5s delay to prevent Telegram flooding errors
        }
    } catch (e) {
        console.error("Processing Error:", e);
        ctx.reply("❌ Error: The text contains characters I can't process. Try sending it as a .txt file instead.");
    }
}

bot.command('start_story', (ctx) => {
    userSessions[ctx.from.id] = "";
    ctx.reply('📥 Collection Mode ON. Paste your story chunks. When finished, send /end_story');
});

bot.command('end_story', async (ctx) => {
    const userId = ctx.from.id;
    if (!userSessions[userId]) return ctx.reply("Your story buffer is empty!");
    
    ctx.reply("⏳ Processing large story... please wait.");
    await processAndSend(ctx, userSessions[userId]);
    delete userSessions[userId];
});

// DOCUMENT / TXT FILE HANDLER
bot.on('document', async (ctx) => {
    try {
        const doc = ctx.message.document;
        // Accept common text mimetypes
        if (doc.mime_type === 'text/plain' || doc.file_name.endsWith('.txt')) {
            ctx.reply("📄 Reading file...");
            const fileUrl = await ctx.telegram.getFileLink(doc.file_id);
            const response = await axios.get(fileUrl.href);
            await processAndSend(ctx, response.data);
        } else {
            ctx.reply("❌ Please send a valid .txt file.");
        }
    } catch (err) {
        ctx.reply("❌ Failed to read the file.");
    }
});

bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    const text = ctx.message.text;
    if (text.startsWith('/')) return;

    if (userSessions[userId] !== undefined) {
        userSessions[userId] += text + "\n";
        // Silent collection (no reply) to avoid bot lag
        return;
    }

    await processAndSend(ctx, text);
});

bot.launch();
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
