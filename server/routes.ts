import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { insertSavedPhraseSchema } from "@shared/schema";
import Anthropic from "@anthropic-ai/sdk";
import { chromium } from "playwright";

const anthropic = new Anthropic();

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // === TRANSLATION ENDPOINT ===
  app.post("/api/translate", async (req, res) => {
    try {
      const { text, targetLanguage, tone, chatContext, direction } = req.body;
      // direction: "to_foreign" (Korean→EN/JA) or "to_korean" (EN/JA→Korean)
      if (!text || !targetLanguage) {
        return res.status(400).json({ error: "text와 targetLanguage가 필요합니다." });
      }

      const langMap: Record<string, string> = {
        en: "English",
        ja: "Japanese",
      };
      const langName = langMap[targetLanguage] || targetLanguage;
      const isToKorean = direction === "to_korean";

      const toneInstructions: Record<string, string> = {
        formal: `Use polite and professional language. For Japanese: use keigo (敬語) with です/ます form. For English: use formal, courteous phrasing suitable for business. For Korean output: use 합쇼체/하십시오체 or 해요체 as appropriate.`,
        casual: `Use friendly and warm language. For Japanese: use polite casual (です/ます) but warmer tone. For English: conversational but still professional. For Korean output: use 해요체, warm and approachable.`,
        premium: `Use luxurious, refined, premium service language. For Japanese: use very polite honorific language (最敬語). For English: elegant, high-end boutique service tone. For Korean output: refined 해요체/합쇼체.`,
      };

      const toneGuide = toneInstructions[tone] || toneInstructions.formal;

      let systemPrompt: string;
      let userMessage: string;

      if (isToKorean) {
        // REVERSE: Foreign → Korean
        systemPrompt = `You are a professional translator for Mirror by Me (미러 바이 미), a premium concept photo profile studio in Gangnam, Seoul, South Korea.

You are translating CUSTOMER MESSAGES (in ${langName}) into Korean for the studio staff to understand.

Studio context:
- Studio name: Mirror by Me (미러 바이 미)
- Main foreign clients: Japanese tourists visiting Seoul, English-speaking tourists
- Services: concept photo shoots, professional hair & makeup, costume rental
- Reservation deposit: 100,000 KRW per person

Translation rules:
1. Translate naturally so Korean studio staff can fully understand what the customer means
2. Preserve nuance, politeness level, and emotional tone of the original message
3. If the customer uses colloquial or slang expressions (especially Japanese internet slang, SNS language, or informal speech), translate them into equivalent natural Korean expressions — not word-for-word
4. For Japanese input: be especially careful with:
   - Keigo vs casual speech (distinguish politeness level clearly)
   - Japanese SNS/young people expressions (ありがとう→고마워요, めちゃくちゃ→엄청, かわいい→귀여워요, etc.)
   - Implicit meanings (Japanese often leave things unsaid — infer the full meaning)
   - Date/time expressions and counting systems
   - Photography-related terms: 撮影→촬영, ヘアメイク→헤어메이크업, コスチューム→의상, 予約→예약
5. For English input: translate casual/informal expressions naturally into Korean
6. Add a brief [뉘앙스] note in parentheses if the original tone is: very urgent, apologetic, confused, dissatisfied, or especially enthusiastic — so staff can respond appropriately
7. Output: translated Korean text, then the [뉘앙스] note if applicable. No other explanations.
${chatContext ? `
## 대화 컨텍스트:
${chatContext}

Use this context to better understand the customer's message and translate with full nuance.` : ""}`;

        userMessage = `Translate this ${langName} customer message to Korean:\n\n${text}`;
      } else {
        // FORWARD: Korean → Foreign
        systemPrompt = `You are a professional translator for Mirror by Me (미러 바이 미), a premium concept photo profile studio in Gangnam, Seoul, South Korea.

Studio context:
- Studio name: Mirror by Me (미러 바이 미)
- Location: Seoul, Gangnam-gu, Seolleung-ro 111-gil 22-8, UN Building B1 (선릉역 근처)
- The photographer has 15+ years of fashion editorial experience and has shot celebrities like Song Kang, Cha Eun-woo, and Red Velvet
- Services: concept photo shoots with in-house professional hair & makeup, costume rental
- Reservation deposit: 100,000 KRW per person via bank transfer
- 1 concept = 1 lighting + 1 background + 1 costume + 1 hair & makeup, ~250-300 photos delivered
- Main clients: Korean locals and Japanese tourists visiting Seoul
- KakaoTalk channel: https://pf.kakao.com/_bxdzbs
- Instagram: https://www.instagram.com/mirror_by_me/

Translation rules:
1. Translate naturally as a professional studio staff member would communicate — warm, polished, never robotic
2. Preserve the original meaning and nuance completely
3. ${toneGuide}
4. For Japanese: use natural Japanese that Japanese customers actually use, not textbook translations. Use appropriate photography/beauty industry terms (撮影, ヘアメイク, コスチューム, etc.)
5. For English: use natural hospitality English appropriate for a premium photography studio
6. Keep studio-specific terms consistent: 컨셉 → コンセプト/concept, 화보 → 撮影/photo shoot, 예약금 → 予約金/deposit
7. Output ONLY the translated text — no explanations, no notes, no original text
${chatContext ? `
## Current conversation context (use this to make the translation more natural and relevant):
${chatContext}

Use this context to:
- Address the customer by name if known
- Reference specific details they mentioned (dates, concepts, requests)
- Match the appropriate level of formality based on the conversation so far
- Make the response feel like a natural continuation of the ongoing conversation` : ""}`;

        userMessage = `Translate the following Korean text to ${langName}:\n\n${text}`;
      }

      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: userMessage,
          },
        ],
        system: systemPrompt,
      });

      const translatedText = message.content[0].type === "text" ? message.content[0].text : "";

      // Save to history
      await storage.addTranslationHistory({
        originalText: text,
        translatedText,
        targetLanguage: isToKorean ? `${targetLanguage}_to_ko` : targetLanguage,
        tone: tone || "formal",
      });

      res.json({ translatedText });
    } catch (error: any) {
      console.error("Translation error:", error);
      res.status(500).json({ error: "번역 중 오류가 발생했습니다." });
    }
  });

  // === AUTO-DETECT LANGUAGE ===
  app.post("/api/detect-language", async (req, res) => {
    const { text } = req.body;
    if (!text || text.trim().length < 2) {
      return res.json({ language: "ko", confidence: "low" });
    }
    // Quick heuristic detection (no API call needed)
    const sample = text.trim().slice(0, 200);
    // Check for Japanese characters
    const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(sample);
    const hasHiragana = /[\u3040-\u309F]/.test(sample);
    const hasKatakana = /[\u30A0-\u30FF]/.test(sample);
    // Check for Korean
    const hasKorean = /[\uAC00-\uD7A3\u1100-\u11FF\u3130-\u318F]/.test(sample);
    // Check for English (mostly ASCII letters)
    const asciiLetters = (sample.match(/[a-zA-Z]/g) || []).length;
    const totalChars = sample.replace(/\s/g, "").length;
    const isEnglish = !hasKorean && !hasHiragana && !hasKatakana && asciiLetters / totalChars > 0.5;

    let language = "ko";
    if (hasHiragana || hasKatakana) {
      language = "ja";
    } else if (isEnglish) {
      language = "en";
    } else if (hasKorean) {
      language = "ko";
    } else if (hasJapanese) {
      language = "ja"; // CJK only
    }

    res.json({ language });
  });

  // === FETCH CHAT CONTEXT FROM URL ===
  app.post("/api/fetch-chat", async (req, res) => {
    const { url } = req.body;
    if (!url || !url.startsWith("http")) {
      return res.status(400).json({ error: "올바른 URL을 입력해주세요." });
    }

    let browser;
    try {
      // Try to connect to user's local Chrome via CDP first (port 9222)
      // If not available, fall back to launching headless Chromium
      let page;
      try {
        browser = await chromium.connectOverCDP("http://localhost:9222");
        const contexts = browser.contexts();
        const ctx = contexts[0] ?? await browser.newContext();
        page = await ctx.newPage();
      } catch {
        // Local Chrome not available — use headless Chromium
        browser = await chromium.launch({ headless: true });
        const ctx = await browser.newContext();
        page = await ctx.newPage();
      }

      await page.goto(url, { waitUntil: "networkidle", timeout: 20000 });
      await page.waitForTimeout(1500);

      // Extract all visible text from the page
      const rawText = await page.evaluate(() => {
        // Try to get chat messages specifically
        const selectors = [
          // KakaoTalk business chat selectors
          ".chat_area", ".message_list", ".chat_list",
          "[class*='chat']", "[class*='message']", "[class*='msg']",
          // Fallback: all meaningful text
          "main", "#app", "#root", "body"
        ];

        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el) {
            const text = (el as HTMLElement).innerText;
            if (text && text.trim().length > 100) {
              return text.trim();
            }
          }
        }
        return document.body.innerText;
      });

      await page.close();
      await browser.close();

      // Summarize the chat context using Claude
      const summaryMsg = await anthropic.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 800,
        system: `You are analyzing a KakaoTalk business channel chat conversation for Mirror by Me (미러 바이 미) photo studio in Seoul.
Extract and summarize:
1. Customer name and language (Korean/Japanese/English)
2. What they're asking about or discussing
3. Current status of the conversation (first inquiry / negotiating / confirmed / issue etc.)
4. Any specific details mentioned (dates, concepts, services, requests)
5. Overall tone/mood of the customer

Respond in Korean, concisely (3-5 sentences max). Start with "[컨텍스트]" prefix.`,
        messages: [{ role: "user", content: `다음 채팅 내용을 분석해주세요:\n\n${rawText.slice(0, 3000)}` }]
      });

      const summary = summaryMsg.content[0].type === "text" ? summaryMsg.content[0].text : "";

      res.json({ 
        success: true, 
        summary,
        rawLength: rawText.length 
      });

    } catch (error: any) {
      if (browser) {
        try { await browser.close(); } catch {}
      }
      console.error("fetch-chat error:", error);

      // Provide helpful error messages
      if (error.message?.includes("net::ERR") || error.message?.includes("timeout")) {
        return res.status(400).json({ 
          error: "페이지를 열 수 없습니다. URL을 확인하거나 카카오 비즈니스에 로그인되어 있는지 확인해주세요."
        });
      }
      res.status(500).json({ error: "채팅 내용을 불러오는 중 오류가 발생했습니다." });
    }
  });

  // === SAVED PHRASES ===
  app.get("/api/phrases", async (req, res) => {
    const phrases = await storage.getSavedPhrases();
    res.json(phrases);
  });

  app.post("/api/phrases", async (req, res) => {
    try {
      const data = insertSavedPhraseSchema.parse(req.body);
      const phrase = await storage.createSavedPhrase(data);
      res.json(phrase);
    } catch (error) {
      res.status(400).json({ error: "유효하지 않은 데이터입니다." });
    }
  });

  app.patch("/api/phrases/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const updated = await storage.updateSavedPhrase(id, req.body);
    if (!updated) return res.status(404).json({ error: "문구를 찾을 수 없습니다." });
    res.json(updated);
  });

  app.delete("/api/phrases/:id", async (req, res) => {
    const deleted = await storage.deleteSavedPhrase(parseInt(req.params.id));
    if (!deleted) return res.status(404).json({ error: "문구를 찾을 수 없습니다." });
    res.json({ success: true });
  });

  // === HISTORY ===
  app.get("/api/history", async (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const history = await storage.getTranslationHistory(limit);
    res.json(history);
  });

  app.delete("/api/history", async (req, res) => {
    await storage.clearTranslationHistory();
    res.json({ success: true });
  });

  return httpServer;
}
