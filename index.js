const { Telegraf } = require('telegraf');
const express = require('express');
const axios = require('axios'); // Add this line here


const BOT_TOKEN = process.env.BOT_TOKEN;
const PORT = process.env.PORT || 3000;

const SIGNATURE = "\n\n---\n👉 Follow for more!";

// --- CONFIGURATION ---
const PREMIUM_USERS = ['realghostzero']; 
const DAILY_LIMIT = 5;
const userUsage = {}; 
const lastSuccessMsg = {}; 
let totalStoriesProcessed = 0;

// --- EXPANDED & CATEGORIZED DICTIONARY ---
const dictionary = {
    // Priority Sexual/Sensitive (Ensuring double $$)
    'massage': 'ma$$age',
    'massaged': 'ma$$aged',
    'massaging': 'ma$$aging',
    'pussy': 'pu$$y',
    'kisses': 'k!sses',
    'kissing': 'k!ssing',
    'kiss': 'k!ss',

    // Nudity/Sex
    'sex': 's3x',
    'sexy': 's3xy',
    'sexting': 's3xting',
    'nude': 'n¥de',
    'nudes': 'n¥des',
    'naked': 'n@ked',
    'nakedness': 'n@kedness',
    'porn': 'p×rn',
    'dick': 'd!ck',
    'cock': 'c0ck',
    'vagina': 'v@gina',
    'penis': 'p3nis',
    'orgasm': 'org@sm',
    'clit': 'cl!t',
    'ejaculate': 'ej@culate',
    'condom': 'c0ndom',
    'dildo': 'd!ldo',
    'erotic': 'er0tic',
    'hentai': 'h3ntai',
    'milf': 'm!lf',
    'sperm': 'sp3rm',
    'boobs': 'bo0b$',
    'boob': 'bo0b',
    'breast': 'br3ast',
    'breasts': 'br3asts',
    'nipple': 'n!pple',
    'nipples': 'n!pples',
    'titty': 't!ttys',
    'tits': 't!ts',
    'tit': 't!t',
    'butt': 'bu++',
    'bra': 'br@',
    'panties': 'p@nties',
    'lingerie': 'ling3rie',
    'threesome': '3some',
    'orgies': 'orgi3s',
    'orgy': 'orgi3',
    'masturbate': 'm@sturbate',
    'cum': 'c¥m',
    'cumming': 'c¥mming',
    'balls': 'b@lls',
    'ass': '@ss',

    // Violence
    'kill': 'k×ll',
    'killing': 'k×lling',
    'killed': 'k×lled',
    'dead': 'd3ad',
    'death': 'd3ath',
    'murder': 'm¥rder',
    'blood': 'bl00d',
    'suicide': 's¥i¢ide',
    'rape': 'r@pe',
    'torture': 't0rture',
    'stab': 'st@b',
    'shoot': 'sh00t',
    'bullet': 'b¥llet',
    'strangle': 'str@ngle',
    'corpse': 'c0rpse',
    'gun': 'g¥n',
    'weapon': 'we@pon',

    // Profanity
    'fuck': 'f¥ck',
    'fucking': 'f¥ckin',
    'fucked': 'f¥cked',
    'bitch': 'bi+ch',
    'shit': 'sh!t',
    'asshole': 'a$$hole',
    'bastard': 'b@stard',
    'cunt': 'c¥nt',
    'slut': 'sl¥t',
    'whore': 'wh0re',
    'motherfucker': 'mofo',

    // Sensitive Environments
    'bedroom': 'b3droom',
    'bed': 'b3d',
    'moan': 'm0an',
    'moaning': 'm0aning',
    'tongue': 't0ngue',
    'naughty': 'n@ughty',
    'desire': 'des!re'
};

const bot = new Telegraf(BOT_TOKEN);
const app = express();

app.get('/', (req, res) => res.send('Bot Active'));
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- MODIFIED MASKING FUNCTION WITH WORD BOUNDARIES ---
function maskText(text) {
    let result = text;
    const sortedKeys = Object.keys(dictionary).sort((a, b) => b.length - a.length);
    for (const word of sortedKeys) {
        // \b ensures we only match whole words (e.g., 'gun' but not 'begun')
        // [^a-zA-Z0-9] handles boundaries if \b acts up with special symbols
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

function insertSneakyAd(text) {
    const paragraphs = text.split('\n').filter(p => p.trim() !== "");
    if (paragraphs.length < 3) return text + "\n(Masked by: https://t.me/fb_story_masker_bot)";
    const randomIndex = Math.floor(Math.random() * (paragraphs.length - 2)) + 1;
    paragraphs[randomIndex] += " (Masked by: https://t.me/fb_story_masker_bot)";
    return paragraphs.join('\n\n');
}

async function processAndSend(ctx, rawText) {
    const userId = ctx.from.id;
    const username = ctx.from.username || "NoUsername";
    const isPremium = PREMIUM_USERS.includes(username);
    
    if (!isPremium) {
        userUsage[username] = (userUsage[username] || 0) + 1;
        if (userUsage[username] > DAILY_LIMIT) {
            return ctx.reply("🚫 **Daily Limit Reached!**\n\nTo continue masking unlimited stories and remove the 'Protected by' links, upgrade to Lifetime Premium for just 3 USDT.\n\nMessage @realghostzero to upgrade!");
        }
    }

    totalStoriesProcessed++;
    console.log(`[LOG] User: @${username} | Premium: ${isPremium} | Count: ${userUsage[username] || 'Admin'} | Total: ${totalStoriesProcessed}`);

    let statusMsg;
    try {
        statusMsg = await ctx.reply("⏳ **Masking Story...**");
        
        let processedText = maskText(rawText);
        
        if (!isPremium) {
            processedText = insertSneakyAd(processedText);
        }

        const parts = splitByParagraphs(processedText);
        
        for (let i = 0; i < parts.length; i++) {
            const label = parts.length > 1 ? `📖 *PART ${i + 1} OF ${parts.length}*\n\n` : "";
            try {
                await ctx.reply(label + parts[i] + SIGNATURE, { parse_mode: 'Markdown' });
            } catch (err) {
                await ctx.reply(label + parts[i] + SIGNATURE);
            }
            await sleep(3000); 
        }

        try { await ctx.deleteMessage(statusMsg.message_id); } catch (e) {}

        if (lastSuccessMsg[userId]) {
            try { await ctx.telegram.deleteMessage(ctx.chat.id, lastSuccessMsg[userId]); } catch (e) {}
        }

        const doneMsg = await ctx.reply("✅ **DONE!** You can paste your next story now.\n\nLove this bot? Share it with a fellow writer: https://t.me/fb_story_masker_bot");
        lastSuccessMsg[userId] = doneMsg.message_id;

    } catch (e) {
        console.error(`[ERROR] for @${username}:`, e);
        ctx.reply("❌ Error processing your story.");
    }
}

bot.start((ctx) => {
    ctx.reply('✅ **FB Story Masker Online**\n\nJust paste your story directly here, and I will mask it and split it for you.');
});

bot.on('text', async (ctx) => {
    const text = ctx.message.text;
    if (text.startsWith('/')) return;
    await processAndSend(ctx, text);
});

// Internal Heartbeat to prevent sleeping
setInterval(() => {
    axios.get(`https://fb-story-masker.onrender.com/`).then(() => {
        console.log("Internal heartbeat: Success");
    }).catch((err) => {
        console.log("Internal heartbeat: Pinged");
    });
}, 840000); // 14 minutes


bot.launch();
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
