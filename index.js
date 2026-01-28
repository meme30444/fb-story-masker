const { Telegraf } = require('telegraf');
const express = require('express');

const BOT_TOKEN = process.env.BOT_TOKEN;
const PORT = process.env.PORT || 3000;

const SIGNATURE = "\n\n---\n👉 *Follow for more!*";

// --- CONFIGURATION ---
const PREMIUM_USERS = ['realghostzero']; // Add telegram usernames here (without @)
const DAILY_LIMIT = 5;
const userUsage = {}; // Tracks daily counts: { 'username': count }
let totalStoriesProcessed = 0;

const dictionary = {
    'massage': 'ma$$age',
    'pussy': 'pu$$y',
    'kisses': 'ki$$es',
    'kissing': 'ki$$ing',
    'kiss': 'ki$$',
    'tits': 't*ts',
    'tit': 't*t',
    '18+': 'one-eight+',
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
    'gun': 'g*n', 'weapon': 'we@pon',
    'fuck': 'f*ck', 'fucking': 'f*ckin', 'bitch': 'bi+ch', 'shit': 'sh*t', 'asshole': 'a$$hole',
    'bastard': 'b@stard', 'cunt': 'c*nt', 'slut': 'sl*t', 'whore': 'wh0re', 'motherfucker': 'mofo',
    'bedroom': 'b3droom', 'bed': 'b-e-d', 'moan': 'm0an', 'tongue': 't0ngue', 'nakedness': 'n@kedness', 
    'naughty': 'n@ughty', 'desire': 'des*re'
};

const bot = new Telegraf(BOT_TOKEN);
const app = express();

app.get('/', (req, res) => res.send('Bot Active'));
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function maskText(text) {
    let result = text;
    const sortedKeys = Object.keys(dictionary).sort((a, b) => b.length - a.length);
    for (const word of sortedKeys) {
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

// Logic to insert sneaky ad for free users
function insertSneakyAd(text) {
    const paragraphs = text.split('\n').filter(p => p.trim() !== "");
    if (paragraphs.length < 3) return text + "\n(Masked by: https://t.me/fb_story_masker_bot)";
    
    // Pick a random spot that isn't the very first or very last paragraph
    const randomIndex = Math.floor(Math.random() * (paragraphs.length - 2)) + 1;
    paragraphs[randomIndex] += " (Masked by: https://t.me/fb_story_masker_bot)";
    
    return paragraphs.join('\n\n');
}

async function processAndSend(ctx, rawText) {
    const username = ctx.from.username || "NoUsername";
    const isPremium = PREMIUM_USERS.includes(username);
    
    // Check Daily Limit for Free Users
    if (!isPremium) {
        userUsage[username] = (userUsage[username] || 0) + 1;
        if (userUsage[username] > DAILY_LIMIT) {
            return ctx.reply("🚫 **Daily Limit Reached!**\n\nTo continue masking unlimited stories and remove the 'Protected by' links, upgrade to Lifetime Premium for just 3 USDT.\n\nMessage @realghostzero to upgrade!");
        }
    }

    // Logging
    totalStoriesProcessed++;
    console.log(`[LOG] User: @${username} | Premium: ${isPremium} | Count: ${userUsage[username] || 'Admin'} | Total: ${totalStoriesProcessed}`);

    let statusMsg;
    try {
        statusMsg = await ctx.reply("⏳ **Masking Story...**");
        
        let processedText = maskText(rawText);
        
        // Add sneaky ad if NOT premium
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
        await ctx.reply("✅ **DONE!** You can paste your next story now.\n\nLove this bot? Share it with a fellow writer: https://t.me/fb_story_masker_bot");

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

bot.launch();
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
