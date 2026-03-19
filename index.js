require('dotenv').config();
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const RETURN_WEBHOOK_URL = process.env.RETURN_WEBHOOK_URL;

// Initialize OpenAI client pointing to OpenRouter
const openai = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
});

// Helper to load skill prompt from the repository
function loadSkillPrompt(skillName) {
    try {
        // Path pointing to the skills folder in the root directory
        const skillPath = path.join(__dirname, '.agent', 'skills', 'threads-agent', skillName, 'SKILL.md');
        if (fs.existsSync(skillPath)) {
            return fs.readFileSync(skillPath, 'utf8');
        } else {
            console.warn(`Skill file not found: ${skillPath}`);
            return null;
        }
    } catch (error) {
        console.error(`Error loading skill ${skillName}:`, error);
        return null;
    }
}

// Ensure return URL is configured
if (!RETURN_WEBHOOK_URL) {
    console.warn("WARNING: RETURN_WEBHOOK_URL is not set in environment variables!");
}

app.post('/api/generate', async (req, res) => {
    const { notion_id, content, type, ideas } = req.body;

    if (!notion_id || !type || !Array.isArray(type)) {
        return res.status(400).json({ error: "Missing required fields or 'type' is not an array." });
    }

    if (!content && !ideas) {
        return res.status(400).json({ error: "At least one of 'content' or 'ideas' must be provided." });
    }

    // 1. Immediately respond to n8n to close the connection and prevent timeout
    res.status(200).json({
        message: "Request received. Processing in background.",
        notion_id,
        processing_types: type
    });

    if (type.includes('do_nothing')) {
        console.log(`[${new Date().toISOString()}] 'do_nothing' received for ${notion_id}. Skipping generation.`);
        if (RETURN_WEBHOOK_URL) {
            axios.post(RETURN_WEBHOOK_URL, {
                notion_id: notion_id,
                results: { draft: "Skipped processing as requested." }
            }).catch(e => console.error("Webhook error:", e.message));
        }
        return;
    }

    const validSkills = ['news_reporter', 'social_media_editor', 'storytelling_editor', 'interactive_storyteller', 'insight_post_generator'];
    const skillsToProcess = type.filter(skill => validSkills.includes(skill));

    if (skillsToProcess.length === 0) {
        console.log(`[${new Date().toISOString()}] No valid skills provided for ${notion_id}. Processing skipped.`);
        return;
    }

    // 2. Process in background
    console.log(`[${new Date().toISOString()}] Started processing ${notion_id} for types: ${skillsToProcess.join(', ')}`);

    try {
        const generationPromises = skillsToProcess.map(async (skillName) => {
            const systemPrompt = loadSkillPrompt(skillName);

            if (!systemPrompt) {
                return { skill: skillName, error: "Skill configuration not found." };
            }

            try {
                let promptMessage = "";
                
                if (content && typeof content === 'string' && content.trim() !== '') {
                    promptMessage += `請根據以下輸入內容，為我撰寫一篇 Threads 貼文：\n\n<input_content>\n${content}\n</input_content>`;
                    
                    if (ideas && typeof ideas === 'string' && ideas.trim() !== '') {
                        promptMessage += `\n\n另外，這是原創作者額外補充的行文思路或想法，請務必將其融入並延伸到貼文內容中：\n<author_ideas>\n${ideas}\n</author_ideas>`;
                    }
                } else if (ideas && typeof ideas === 'string' && ideas.trim() !== '') {
                    promptMessage += `請根據以下原創作者的行文思路或想法，為我撰寫一篇 Threads 貼文：\n\n<author_ideas>\n${ideas}\n</author_ideas>`;
                }

                // Call OpenRouter API
                const response = await openai.chat.completions.create({
                    model: process.env.OPENROUTER_MODEL || "google/gemini-2.5-pro",
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: promptMessage }
                    ],
                    temperature: 0.7
                });

                return {
                    skill: skillName,
                    result: response.choices[0].message.content
                };
            } catch (err) {
                console.error(`OpenRouter API Error for skill ${skillName}:`, err);
                return { skill: skillName, error: err.message };
            }
        });

        const completedResults = await Promise.all(generationPromises);

        // Format results to uniformly use 'draft' as the key
        const draftContent = completedResults.map(item => item.result || item.error).join('\n\n---\n\n');

        // 3. Send results back to n8n Webhook
        console.log(`[${new Date().toISOString()}] Finished processing ${notion_id}. Sending to n8n webhook...`);

        if (RETURN_WEBHOOK_URL) {
            await axios.post(RETURN_WEBHOOK_URL, {
                notion_id: notion_id,
                results: { draft: draftContent }
            });
            console.log(`Successfully sent webhook data for ${notion_id} to n8n.`);
        } else {
            console.log("Skipping sending to n8n (RETURN_WEBHOOK_URL is missing). Here are the results:", { draft: draftContent });
        }

    } catch (globalError) {
        console.error(`[${new Date().toISOString()}] Critical error processing ${notion_id}:`, globalError);
    }
});

// Healthcheck endpoint for Zeabur
app.get('/', (req, res) => {
    res.send('Threads Agent n8n server (OpenRouter variant) is running!');
});

app.listen(PORT, () => {
    console.log(`Zeabur Agent Server running on port ${PORT}`);
});
