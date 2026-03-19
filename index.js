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

    if (type.includes('do_nothing')) {
        console.log(`[${new Date().toISOString()}] 'do_nothing' received for ${notion_id}. Skipping generation.`);
        if (RETURN_WEBHOOK_URL) {
            axios.post(RETURN_WEBHOOK_URL, {
                notion_id: notion_id,
                results: { draft: "Skipped processing as requested." }
            }).catch(e => console.error("Webhook error:", e.message));
        }
        return res.status(200).json({ success: true, results: { draft: "Skipped processing as requested." } });
    }

    const validSkills = ['news_reporter', 'social_media_editor', 'storytelling_editor', 'interactive_storyteller', 'insight_post_generator'];
    const skillsToProcess = type.filter(skill => validSkills.includes(skill));

    if (skillsToProcess.length === 0) {
        console.log(`[${new Date().toISOString()}] No valid skills provided for ${notion_id}. Processing skipped.`);
        return res.status(400).json({ success: false, error: "No valid skills provided." });
    }

    // 2. Process in background
    console.log(`[${new Date().toISOString()}] Started processing ${notion_id} for types: ${skillsToProcess.join(', ')}`);

    let authorCsvContent = "";
    const dnaFolderPath = path.join(__dirname, 'author_dna');
    try {
        if (fs.existsSync(dnaFolderPath)) {
            const files = fs.readdirSync(dnaFolderPath).filter(f => f.toLowerCase().endsWith('.csv'));
            if (files.length > 0) {
                const csvFile = path.join(dnaFolderPath, files[0]);
                // 讀取檔案，為避免檔案過大 (如超過 200k token) 造成從 API 崩潰，加上防呆截斷
                const rawCsv = fs.readFileSync(csvFile, 'utf8');
                // 中文字元在部分模型 (如 StepFun) 會被計算為接近 1:1 或更多的 tokens，
                // 為了安全起見，將截斷限制大幅下調至 50,000 字元 (約數十至上百篇貼文，絕對夠分析風格)
                const MAX_CSV_LENGTH = 50000; 
                
                authorCsvContent = rawCsv.length > MAX_CSV_LENGTH 
                    ? rawCsv.substring(0, MAX_CSV_LENGTH) + "\n\n...[截斷：原檔案太大，僅保留部分內容供風格分析]"
                    : rawCsv;
                    
                console.log(`[${new Date().toISOString()}] Loaded Author DNA CSV: ${files[0]} (Length: ${authorCsvContent.length})`);
            }
        }
    } catch (csvError) {
        console.warn(`[${new Date().toISOString()}] Failed to read Author DNA CSV:`, csvError.message);
    }

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

                if (authorCsvContent) {
                    promptMessage += `\n\n【寫作 DNA 參考與模仿】：\n請掃描以下 CSV 資料中的 \`Caption\` 與 \`Title\` 欄位，深度模仿該作者的寫作 DNA：\n1. 排版格式：他喜歡空行嗎？（通常 Threads 貼文喜歡一句一行或極簡短的段落）。是否有特定的分隔線習慣？（例如 === 或 ---）。列表是用 - 還是 🔸？\n2. 用語習慣：喜歡用「我」還是「我們」？語氣是說教、分享、自嘲還是憤世嫉俗？是否使用特定的口語或網路用語？\n3. 表情符號 (Emoji)：使用頻率如何？喜歡用哪些特定的 Emoji？（如 🔥, 🧵, 👇）\n<author_csv_data>\n${authorCsvContent}\n</author_csv_data>`;
                }

                promptMessage += `\n\n【重要指令】：請直接輸出最終的貼文內容，**不要**包含任何思考過程、段落標題、分析說明或是多餘的聊天文字。這是一個自動化 API 操作，請絕對只要回傳可以直接發布的貼文本文。`;

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

        const errors = completedResults.filter(item => item.error);
        if (errors.length > 0) {
            const errorDetails = errors.map(e => `[${e.skill}] ${e.error}`).join('; ');
            return res.status(500).json({ success: false, error: `Generation failed: ${errorDetails}` });
        }

        // Format results to uniformly use 'draft' as the key
        const draftContent = completedResults.map(item => item.result).join('\n\n---\n\n');

        // 3. Send results back
        console.log(`[${new Date().toISOString()}] Finished processing ${notion_id}.`);

        if (RETURN_WEBHOOK_URL) {
            axios.post(RETURN_WEBHOOK_URL, {
                notion_id: notion_id,
                results: { draft: draftContent }
            }).catch(e => console.error("Webhook error:", e.message));
        }

        return res.status(200).json({
            success: true,
            results: { draft: draftContent }
        });

    } catch (globalError) {
        console.error(`[${new Date().toISOString()}] Critical error processing ${notion_id}:`, globalError);
        if (!res.headersSent) {
            return res.status(500).json({ success: false, error: globalError.message });
        }
    }
});

// Healthcheck endpoint for Zeabur
app.get('/', (req, res) => {
    res.send('Threads Agent n8n server (OpenRouter variant) is running!');
});

app.listen(PORT, () => {
    console.log(`Zeabur Agent Server running on port ${PORT}`);
});
