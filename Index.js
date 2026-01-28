const { Telegraf } = require('telegraf');
const express = require('express');

// --- CONFIGURATION ---
const BOT_TOKEN = process.env.BOT_TOKEN;
const PORT = process.env.PORT || 3000;

// COMPREHENSIVE MASKING DICTIONARY
const dictionary = {
    // Nudity / Body Parts
    'sex': 's*x', 'sexy': 's3xy', 'nude': 'n*de', 'naked': 'n@ked', 'porn': 'p*rn',
    'pussy': 'pu$$y', 'dick': 'd*ck', 'cock': 'c0ck', 'vagina': 'v@gina', 'penis': 'p3nis',
    'orgasm': 'org@sm', 'clit': 'cl*t', 'ejaculate': 'ej@culate', 'condom': 'c0ndom',
    'erotic': 'er0tic', 'hentai': 'h3ntai', 'milf': 'm*lf', 'sperm': 'sp3rm',
    'boobs': 'bo0b$', 'boob': 'bo0b', 'breast': 'br3ast', 'nipple': 'n*pple', 'butt': 'bu++',
    
    // Violence / Gore
    'kill': 'k*ll', 'dead': 'd3ad', 'death': 'd3ath', 'murder': 'm*rder', 'blood': 'bl00d',
    'suicide': 'sui-cide', 'rape': 'r@pe', 'torture': 't0rture', 'stab': 'st@b',
    'shoot': 'sh00t', 'bullet': 'b*llet', 'strangle': 'str@ngle', 'corpse': 'c0rpse',
    
    // Profanity
    'fuck': 'f*ck', 'fucking': 'f*ckin', 'bitch': 'bi+ch', 'shit': 'sh*t', 'asshole': 'a$$hole',
    'bastard': 'b@stard', 'cunt': 'c*nt', 'dickhead': 'd*ckhead', 'faggot': 'f@ggot',
    'nigger': 'n-word', 'slut': 'sl*t', 'whore': 'wh0re', 'motherfucker': 'mofo',
    
    // Romance / Sensitive
    'kiss': 'ki$$', 'kissing': 'ki$$ing', 'bedroom': 'b3droom', 'bed': 'b-e-d'
};

const bot = new Telegraf(BOT_TOKEN);
const app = express();

// Render Health Check - Vital for keeping the service alive
app.get('/', (req, res) => res.send('Bot Status: Healthy and Active'));
app.listen(PORT, () => console.log(`Web server listening on port ${PORT}`));

// Function to mask words
function maskText(text) {
    let result = text;
    // Sort keys by length descending to catch 'fucking' before 'fuck'
    const sortedWords = Object.keys(dictionary).sort((a, b) => b.length - a.length);
    
    for (const word of sortedWords) {
        const mask = dictionary[word];
        // \b ensures we only hit whole words, gi = global and case-insensitive
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        result = result.replace(regex, mask);
    }
    return result;
}

// Function to split text without breaking paragraphs
function splitByParagraphs(text, limit = 3500) {
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

bot.start((ctx) => ctx.reply('✅ Bot Online! Send me your story, and I will mask it and split it into parts for Facebook.'));

bot.on('text', async (ctx) => {
    const original = ctx.message.text;
    if (original.length < 2) return;

    try {
        const censored = maskText(original);
        const parts = splitByParagraphs(censored);

        for (let i = 0; i < parts.length; i++) {
            const label = parts.length > 1 ? `📝 **PART ${i + 1}**\n\n` : "";
            // Using Markdown formatting for the label
            await ctx.reply(label + parts[i], { parse_mode: 'Markdown' });
        }
    } catch (e) {
        console.error("Error processing text:", e);
        ctx.reply("❌ Error processing story.");
    }
});

// Launch bot
bot.launch()
    .then(() => console.log('Telegram Bot Started'))
    .catch((err) => console.error('Failed to launch bot:', err));

// ENABLE GRACEFUL STOP (Crucial for Render/Production)
process.once('SIGINT', () => {
    console.log('SIGINT signal received: closing bot');
    bot.stop('SIGINT');
});
process.once('SIGTERM', () => {
    console.log('SIGTERM signal received: closing bot');
    bot.stop('SIGTERM');
});
