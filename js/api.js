// ==========================================================================
// DeepScroll AI Service (Unified Prompt Engineering & Dispatcher)
// ==========================================================================

class AIService {
  constructor() {
    this.provider = localStorage.getItem('ds_api_provider') || 'gemini';
    this.geminiKey = localStorage.getItem('ds_gemini_key') || '';
    this.openRouterKey = localStorage.getItem('ds_openrouter_key') || '';
    this.geminiModel = localStorage.getItem('ds_gemini_model') || 'gemini-2.0-flash';
    this.openRouterModel = localStorage.getItem('ds_openrouter_model') || 'google/gemini-2.0-flash-exp:free';
    this.webSearchEnabled = localStorage.getItem('ds_web_search') === 'true';
    this.logs = [];
  }

  addLog(entry) {
    const logItem = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      time: new Date().toLocaleTimeString(),
      ...entry
    };
    this.logs.unshift(logItem);
    if (this.logs.length > 50) this.logs.pop();
    window.dispatchEvent(new CustomEvent('ds_log_updated', { detail: logItem }));
    return logItem;
  }

  getLogs() {
    return this.logs;
  }

  clearLogs() {
    this.logs = [];
    window.dispatchEvent(new CustomEvent('ds_log_updated', { detail: null }));
  }

  saveConfig({ provider, geminiKey, openRouterKey, geminiModel, openRouterModel, webSearchEnabled }) {
    if (provider) { this.provider = provider; localStorage.setItem('ds_api_provider', provider); }
    if (geminiKey !== undefined) { this.geminiKey = geminiKey.trim(); localStorage.setItem('ds_gemini_key', this.geminiKey); }
    if (openRouterKey !== undefined) { this.openRouterKey = openRouterKey.trim(); localStorage.setItem('ds_openrouter_key', this.openRouterKey); }
    if (geminiModel) { this.geminiModel = geminiModel; localStorage.setItem('ds_gemini_model', geminiModel); }
    if (openRouterModel) { this.openRouterModel = openRouterModel; localStorage.setItem('ds_openrouter_model', openRouterModel); }
    if (webSearchEnabled !== undefined) { this.webSearchEnabled = !!webSearchEnabled; localStorage.setItem('ds_web_search', this.webSearchEnabled); }
  }

  getActiveKey() {
    return this.provider === 'gemini' ? this.geminiKey : this.openRouterKey;
  }

  getActiveModel() {
    return this.provider === 'gemini' ? this.geminiModel : this.openRouterModel;
  }

  hasValidKey() {
    const key = this.getActiveKey();
    return !!(key && key.length > 5);
  }

  async testConnection() {
    const activeKey = this.getActiveKey();
    const providerName = this.provider === 'gemini' ? 'Google Gemini' : 'OpenRouter';
    if (!activeKey || activeKey.trim().length < 3) throw new Error(`Missing ${providerName} API Key in Settings.`);

    const startTime = performance.now();
    const prompt = 'Respond with JSON: {"status": "ok", "message": "connected"}';
    const result = await this.callAI(prompt, true, 'TEST_CONNECTION');
    const latencyMs = Math.round(performance.now() - startTime);

    return {
      status: 'ok',
      provider: providerName,
      model: this.getActiveModel(),
      latency: latencyMs,
      raw: result
    };
  }

  async fetchOpenRouterModels(forceRefresh = false) {
    return window.openRouterClient.fetchModels(forceRefresh);
  }

  async generateLearningPlan(topic, difficulty = 'Intermediate') {
    if (!this.hasValidKey()) throw new Error(`Please add your API key in Settings (⚙️).`);

    const prompt = `You are an expert curriculum designer. Topic: "${topic}" (${difficulty} level).
Create a structured curriculum of 4 to 6 sequential milestones with target question counts (3 to 8, default 5).
Return ONLY JSON:
{
  "topic": "${topic}",
  "difficulty": "${difficulty}",
  "title": "Mastering ${topic}",
  "summary": "1-2 sentence overview",
  "modules": [
    {
      "id": 1,
      "title": "Module Title",
      "summary": "1 sentence describing key concepts",
      "keyConcepts": ["Concept 1", "Concept 2"],
      "targetQuestions": 5
    }
  ]
}`;

    const planSchema = window.DeepScrollSchemas?.planSchema || null;
    const response = await this.callAI(prompt, true, `PLAN_GEN: ${topic}`, planSchema);
    const parsed = this.cleanAndParseJSON(response);
    if (parsed && Array.isArray(parsed.modules) && parsed.modules.length > 0) return parsed;
    throw new Error('AI returned an unexpected plan format. Please try again.');
  }

  async generateTopicBatch(topic, currentModule, moduleIndex, totalModules, count = 2, previousQuestions = []) {
    if (!this.hasValidKey()) throw new Error(`Please add your API key in Settings (⚙️).`);

    const prevList = previousQuestions.slice(-10).map(q => `- ${q.question}`).join('\n');
    const concepts = currentModule.summary || (currentModule.keyConcepts ? currentModule.keyConcepts.join(', ') : currentModule.title);

    const prompt = `Subject: "${topic}" (Difficulty: ${currentModule.difficulty || 'Intermediate'})
Active Topic (${moduleIndex + 1}/${totalModules}): "${currentModule.title}"
Concepts: "${concepts}"

Generate exactly ${count} distinct multiple-choice questions focused SOLELY on "${currentModule.title}".
Avoid repeating:
${prevList || 'None yet'}

RULES:
1. Every question must directly test "${currentModule.title}".
2. All 4 options (A,B,C,D) MUST be unique, realistic technical choices. NEVER use generic placeholder options.
3. Vary correct answer index (0-3).
4. Provide a 1-2 sentence explanation.
5. Provide a Perplexity research query.

Return ONLY JSON:
{
  "moduleTitle": "${currentModule.title}",
  "questions": [
    {
      "id": "q_mod${moduleIndex + 1}_${Date.now()}_1",
      "moduleIndex": ${moduleIndex},
      "moduleTitle": "${currentModule.title}",
      "question": "Question about ${currentModule.title}?",
      "codeSnippet": "",
      "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
      "correctAnswerIndex": 0,
      "explanation": "Clear explanation of the mental model.",
      "perplexityQuery": "Explain in depth ${currentModule.title} concepts in ${topic}"
    }
  ]
}`;

    const questionsSchema = window.DeepScrollSchemas?.topicQuestionsSchema || null;
    const response = await this.callAI(prompt, true, `TOPIC [${moduleIndex + 1}/${totalModules}]: ${currentModule.title}`, questionsSchema);
    const parsed = this.cleanAndParseJSON(response);

    let rawQuestions = null;
    if (Array.isArray(parsed)) {
      rawQuestions = parsed;
    } else if (parsed && typeof parsed === 'object') {
      rawQuestions = parsed.questions || parsed.items || parsed.quiz || parsed.cards || parsed.data || null;
      if (!rawQuestions && parsed.question && (parsed.options || parsed.choices)) {
        rawQuestions = [parsed];
      }
      if (!rawQuestions) {
        const vals = Object.values(parsed).filter(v => v && typeof v === 'object' && (v.question || v.options));
        if (vals.length > 0) rawQuestions = vals;
      }
    }

    if (Array.isArray(rawQuestions) && rawQuestions.length > 0) {
      return rawQuestions.map((q, idx) => {
        let options = q.options || q.choices || q.answers || [];
        if (!Array.isArray(options) && typeof options === 'object') options = Object.values(options);
        if (!Array.isArray(options) || options.length < 2) options = ['Option A', 'Option B', 'Option C', 'Option D'];

        let corrIdx = 0;
        if (typeof q.correctAnswerIndex === 'number') corrIdx = q.correctAnswerIndex;
        else if (typeof q.correct_answer_index === 'number') corrIdx = q.correct_answer_index;
        else if (typeof q.answerIndex === 'number') corrIdx = q.answerIndex;
        else if (typeof q.answer === 'number') corrIdx = q.answer;
        else if (typeof q.correctAnswer === 'string') {
          const found = options.findIndex(opt => String(opt).toLowerCase().trim() === q.correctAnswer.toLowerCase().trim());
          if (found !== -1) corrIdx = found;
        }

        return {
          id: q.id || `q_mod${moduleIndex + 1}_${Date.now()}_${idx + 1}`,
          moduleIndex: moduleIndex,
          moduleTitle: currentModule.title,
          topicTargetQuestions: currentModule.targetQuestions || 4,
          question: q.question || `Key principle in ${currentModule.title}?`,
          codeSnippet: q.codeSnippet || q.code || '',
          options: options.slice(0, 4),
          correctAnswerIndex: (corrIdx >= 0 && corrIdx < 4) ? corrIdx : 0,
          explanation: q.explanation || `Understanding ${currentModule.title} is essential for mastering this topic.`,
          perplexityQuery: q.perplexityQuery || `Explain ${q.question || currentModule.title} in depth`
        };
      });
    }

    throw new Error(`AI response could not be formatted for "${currentModule.title}". Please inspect logs or retry.`);
  }

  async callAI(prompt, expectJSON = false, callType = 'AI_CALL', jsonSchema = null) {
    const logCallback = (entry) => this.addLog({ type: callType, ...entry });

    if (this.provider === 'gemini') {
      return window.geminiClient.generateContent({
        apiKey: this.geminiKey,
        model: this.geminiModel,
        prompt,
        expectJSON,
        jsonSchema,
        webSearch: this.webSearchEnabled,
        logCallback
      });
    } else {
      return window.openRouterClient.generateChat({
        apiKey: this.openRouterKey,
        model: this.openRouterModel,
        prompt,
        expectJSON,
        jsonSchema,
        webSearch: this.webSearchEnabled,
        logCallback
      });
    }
  }

  cleanAndParseJSON(rawText) {
    if (!rawText) return null;
    let cleaned = rawText.trim();
    // Remove reasoning model <think>...</think> blocks
    cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch && codeBlockMatch[1]) cleaned = codeBlockMatch[1].trim();

    try { return JSON.parse(cleaned); } catch (e) {}

    // Outermost Object { ... }
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const candidate = cleaned.substring(firstBrace, lastBrace + 1);
      try { return JSON.parse(candidate); } catch (e2) {
        try {
          return JSON.parse(candidate.replace(/,\s*([\]}])/g, '$1'));
        } catch (e3) {}
      }
    }

    // Outermost Array [ ... ]
    const firstBracket = cleaned.indexOf('[');
    const lastBracket = cleaned.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      const candidate = cleaned.substring(firstBracket, lastBracket + 1);
      try { return JSON.parse(candidate); } catch (e4) {
        try {
          return JSON.parse(candidate.replace(/,\s*([\]}])/g, '$1'));
        } catch (e5) {}
      }
    }

    return null;
  }
}

window.aiService = new AIService();
