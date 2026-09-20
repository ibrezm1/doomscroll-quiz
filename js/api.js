// ==========================================================================
// DeepScroll AI Service (Google Gemini & OpenRouter Unified Client)
// ==========================================================================

class AIService {
  constructor() {
    this.provider = localStorage.getItem('ds_api_provider') || 'gemini';
    this.geminiKey = localStorage.getItem('ds_gemini_key') || '';
    this.openRouterKey = localStorage.getItem('ds_openrouter_key') || '';
    this.geminiModel = localStorage.getItem('ds_gemini_model') || 'gemini-2.0-flash';
    this.openRouterModel = localStorage.getItem('ds_openrouter_model') || 'google/gemini-2.0-flash-exp:free';
    this.cachedOpenRouterModels = JSON.parse(localStorage.getItem('ds_cached_or_models') || '[]');
    this.webSearchEnabled = localStorage.getItem('ds_web_search') === 'true';
  }

  saveConfig({ provider, geminiKey, openRouterKey, geminiModel, openRouterModel, webSearchEnabled }) {
    if (provider) {
      this.provider = provider;
      localStorage.setItem('ds_api_provider', provider);
    }
    if (geminiKey !== undefined) {
      this.geminiKey = geminiKey.trim();
      localStorage.setItem('ds_gemini_key', this.geminiKey);
    }
    if (openRouterKey !== undefined) {
      this.openRouterKey = openRouterKey.trim();
      localStorage.setItem('ds_openrouter_key', this.openRouterKey);
    }
    if (geminiModel) {
      this.geminiModel = geminiModel;
      localStorage.setItem('ds_gemini_model', geminiModel);
    }
    if (openRouterModel) {
      this.openRouterModel = openRouterModel;
      localStorage.setItem('ds_openrouter_model', openRouterModel);
    }
    if (webSearchEnabled !== undefined) {
      this.webSearchEnabled = !!webSearchEnabled;
      localStorage.setItem('ds_web_search', this.webSearchEnabled);
    }
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

  // Test API Connection with Key Validation and Latency Measurement
  async testConnection() {
    const activeKey = this.getActiveKey();
    const activeModel = this.getActiveModel();
    const providerName = this.provider === 'gemini' ? 'Google Gemini' : 'OpenRouter';

    if (!activeKey || activeKey.trim().length < 3) {
      throw new Error(`Missing ${providerName} API Key. Please paste your key in the field above.`);
    }

    const startTime = performance.now();
    const prompt = 'Respond with JSON: {"status": "ok", "message": "connected"}';
    const result = await this.callAI(prompt, true);
    const latencyMs = Math.round(performance.now() - startTime);

    return {
      status: 'ok',
      provider: providerName,
      model: activeModel,
      latency: latencyMs,
      raw: result
    };
  }

  // Fetch OpenRouter Live Models with Free Model Detection
  async fetchOpenRouterModels(forceRefresh = false) {
    if (!forceRefresh && this.cachedOpenRouterModels && this.cachedOpenRouterModels.length > 0) {
      return this.cachedOpenRouterModels;
    }

    try {
      const res = await fetch('https://openrouter.ai/api/v1/models', {
        method: 'GET',
        mode: 'cors'
      });

      if (!res.ok) throw new Error(`HTTP ${res.status} fetching models`);
      const data = await res.json();
      const rawList = data.data || [];

      // Process and classify models
      const processed = rawList.map(m => {
        const promptPrice = parseFloat(m.pricing?.prompt || '1');
        const completionPrice = parseFloat(m.pricing?.completion || '1');
        const isFree = m.id.endsWith(':free') || (promptPrice === 0 && completionPrice === 0);
        return {
          id: m.id,
          name: m.name || m.id,
          contextLength: m.context_length || 0,
          isFree: isFree,
          description: m.description || ''
        };
      });

      // Sort: Free models first, then alphabetical
      processed.sort((a, b) => {
        if (a.isFree && !b.isFree) return -1;
        if (!a.isFree && b.isFree) return 1;
        return a.name.localeCompare(b.name);
      });

      this.cachedOpenRouterModels = processed;
      localStorage.setItem('ds_cached_or_models', JSON.stringify(processed));
      return processed;
    } catch (err) {
      console.warn('Could not fetch OpenRouter live models, returning defaults:', err);
      if (this.cachedOpenRouterModels && this.cachedOpenRouterModels.length > 0) {
        return this.cachedOpenRouterModels;
      }
      return this.getDefaultOpenRouterModels();
    }
  }

  getDefaultOpenRouterModels() {
    return [
      { id: 'google/gemini-2.0-flash-exp:free', name: 'Google: Gemini 2.0 Flash Exp (free)', isFree: true, contextLength: 1048576 },
      { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Meta: Llama 3.3 70B Instruct (free)', isFree: true, contextLength: 131072 },
      { id: 'deepseek/deepseek-r1:free', name: 'DeepSeek: R1 (free)', isFree: true, contextLength: 65536 },
      { id: 'deepseek/deepseek-chat:free', name: 'DeepSeek: DeepSeek V3 (free)', isFree: true, contextLength: 65536 },
      { id: 'mistralai/mistral-7b-instruct:free', name: 'Mistral 7B Instruct (free)', isFree: true, contextLength: 32768 },
      { id: 'qwen/qwen-2.5-72b-instruct:free', name: 'Qwen 2.5 72B Instruct (free)', isFree: true, contextLength: 32768 },
      { id: 'google/gemini-2.0-flash-001', name: 'Google: Gemini 2.0 Flash', isFree: false, contextLength: 1048576 },
      { id: 'anthropic/claude-3.5-sonnet', name: 'Anthropic: Claude 3.5 Sonnet', isFree: false, contextLength: 200000 },
      { id: 'openai/gpt-4o-mini', name: 'OpenAI: GPT-4o Mini', isFree: false, contextLength: 128000 }
    ];
  }

  // Generate Learning Plan from Topic
  async generateLearningPlan(topic, difficulty = 'Intermediate') {
    if (!this.hasValidKey()) {
      return this.getMockPlan(topic, difficulty);
    }

    const systemPrompt = `You are an expert curriculum designer and educator. The user wants to learn: "${topic}" at a "${difficulty}" level.
Create a high-impact, focused learning curriculum composed of 4 to 6 sequential learning modules.
For each module, assign an appropriate target number of quiz questions (e.g. between 3 and 8 questions, defaulting to 5).

Return ONLY a valid JSON object matching this schema without any markdown formatting or commentary:
{
  "topic": "${topic}",
  "difficulty": "${difficulty}",
  "title": "Mastering ${topic}",
  "summary": "Short 1-2 sentence overview of what will be learned.",
  "modules": [
    {
      "id": 1,
      "title": "Module Title",
      "summary": "1 sentence describing key concepts in this milestone",
      "keyConcepts": ["Concept 1", "Concept 2", "Concept 3"],
      "targetQuestions": 5
    }
  ]
}`;

    try {
      const response = await this.callAI(systemPrompt, true);
      const parsed = this.cleanAndParseJSON(response);
      if (parsed && Array.isArray(parsed.modules) && parsed.modules.length > 0) {
        return parsed;
      }
      throw new Error('Invalid JSON structure received');
    } catch (err) {
      console.warn('AI Plan Generation failed, using intelligent fallback:', err);
      return this.getMockPlan(topic, difficulty);
    }
  }

  // Generate a Batch of 5 Questions based on Learning Plan
  async generateQuestionBatch(topic, plan, batchNumber = 1, count = 5, previousQuestions = []) {
    if (!this.hasValidKey()) {
      return this.getMockBatch(topic, plan, batchNumber, count);
    }

    const planSummary = plan.modules.map((m, i) => `${i + 1}. ${m.title}: ${m.keyConcepts ? m.keyConcepts.join(', ') : m.summary}`).join('\n');
    const prevList = previousQuestions.slice(-10).map(q => `- ${q.question}`).join('\n');

    const prompt = `You are a world-class test engineer creating engaging, bite-sized quiz questions for a TikTok/YouTube Shorts style doomscrolling learning app.
Topic: "${topic}" (Difficulty: ${plan.difficulty || 'Intermediate'})

Curriculum Plan:
${planSummary}

Currently generating Batch #${batchNumber} (${count} questions).
Avoid repeating these previously covered questions:
${prevList || 'None yet'}

Generate exactly ${count} challenging, insightful multiple-choice questions grounded in the plan modules.
For each question, also generate an optimized search query specifically for Perplexity AI deep-dive exploration.

Return ONLY a valid JSON object matching this exact structure with NO surrounding markdown or backticks:
{
  "batch": ${batchNumber},
  "questions": [
    {
      "id": "q_${batchNumber}_1",
      "moduleIndex": 0,
      "moduleTitle": "Name of relevant module",
      "question": "Clear, engaging question prompt?",
      "codeSnippet": "optional code snippet or leave empty string if not code",
      "options": [
        "First option",
        "Second option",
        "Third option",
        "Fourth option"
      ],
      "correctAnswerIndex": 0,
      "explanation": "Clear, 1-2 sentence explanation of why this answer is correct and the underlying mental model.",
      "perplexityQuery": "Search query formatted for Perplexity AI deep dive (e.g. Explain how [Concept] works in [Topic] with practical examples)"
    }
  ]
}`;

    try {
      const response = await this.callAI(prompt, true);
      const parsed = this.cleanAndParseJSON(response);
      if (parsed && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
        return parsed.questions;
      }
      throw new Error('Invalid batch JSON received');
    } catch (err) {
      console.warn('AI Batch Generation failed, using fallback batch:', err);
      return this.getMockBatch(topic, plan, batchNumber, count);
    }
  }

  // Core AI Dispatcher
  async callAI(prompt, expectJSON = false) {
    if (this.provider === 'gemini') {
      return this.callGemini(prompt, expectJSON);
    } else {
      return this.callOpenRouter(prompt, expectJSON);
    }
  }

  // Gemini API Implementation
  async callGemini(prompt, expectJSON) {
    if (!this.geminiKey) throw new Error('Google Gemini API Key is missing. Please enter it in Settings.');

    const model = this.geminiModel || 'gemini-2.0-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.geminiKey}`;

    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        maxOutputTokens: 2048,
        ...(expectJSON ? { responseMimeType: 'application/json' } : {})
      },
      ...(this.webSearchEnabled && !expectJSON ? { tools: [{ googleSearch: {} }] } : {})
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errText = await res.text();
      let errorMsg = `Gemini API Error (${res.status})`;
      try {
        const errJson = JSON.parse(errText);
        errorMsg = errJson.error?.message || errorMsg;
      } catch (e) {}
      throw new Error(errorMsg);
    }

    const data = await res.json();
    const candidate = data.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty response from Gemini API');
    return text;
  }

  // OpenRouter API Implementation
  async callOpenRouter(prompt, expectJSON) {
    if (!this.openRouterKey) throw new Error('OpenRouter API Key is missing. Please enter it in Settings.');

    const model = this.openRouterModel || 'google/gemini-2.0-flash-exp:free';
    const url = 'https://openrouter.ai/api/v1/chat/completions';

    const body = {
      model: model,
      messages: [
        { role: 'system', content: expectJSON ? 'You are an AI that outputs strictly valid JSON without markdown formatting.' : 'You are a helpful AI assistant.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 2048,
      ...(expectJSON ? { response_format: { type: 'json_object' } } : {}),
      ...(this.webSearchEnabled ? {
        tools: [
          { type: 'openrouter:web_search' }
        ]
      } : {})
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.openRouterKey}`
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errText = await res.text();
      let errorMsg = `OpenRouter API Error (${res.status})`;
      try {
        const errJson = JSON.parse(errText);
        errorMsg = errJson.error?.message || errorMsg;
      } catch (e) {}
      throw new Error(errorMsg);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('Empty response from OpenRouter API');
    return content;
  }

  // JSON Extraction helper
  cleanAndParseJSON(rawText) {
    if (!rawText) return null;
    let cleaned = rawText.trim();
    // Remove markdown code fences if present
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.substring(7);
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.substring(3);
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.substring(0, cleaned.length - 3);
    }
    cleaned = cleaned.trim();

    try {
      return JSON.parse(cleaned);
    } catch (e) {
      // Attempt substring between first { and last }
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        const sliced = cleaned.substring(firstBrace, lastBrace + 1);
        return JSON.parse(sliced);
      }
      throw e;
    }
  }

  // Mock Plan Generator (for offline / demo testing before entering key)
  getMockPlan(topic, difficulty) {
    return {
      topic: topic,
      difficulty: difficulty,
      title: `Mastering ${topic}`,
      summary: `A structured ${difficulty}-level curriculum designed for rapid retention and deep conceptual understanding.`,
      modules: [
        {
          id: 1,
          title: `Foundations & Core Principles of ${topic}`,
          summary: `Master fundamental terminology, design architecture, and first-principles mental models.`,
          keyConcepts: ['Core Architecture', 'Key Definitions', 'Mental Models'],
          targetQuestions: 5
        },
        {
          id: 2,
          title: `Mechanisms & Under-the-Hood Operations`,
          summary: `Understand how the system executes, coordinates state, and processes data internally.`,
          keyConcepts: ['State Management', 'Execution Lifecycle', 'Data Flow'],
          targetQuestions: 6
        },
        {
          id: 3,
          title: `Common Pitfalls & Edge Cases`,
          summary: `Analyze common failure modes, performance bottlenecks, and debugging techniques.`,
          keyConcepts: ['Anti-Patterns', 'Performance Bottlenecks', 'Error Handling'],
          targetQuestions: 5
        },
        {
          id: 4,
          title: `Advanced Strategies & Real-World Application`,
          summary: `Apply enterprise best practices, scalable design patterns, and optimization techniques.`,
          keyConcepts: ['Scalability', 'Security & Best Practices', 'Production Patterns'],
          targetQuestions: 5
        }
      ]
    };
  }

  // Mock Batch Generator (for offline / instant preview)
  getMockBatch(topic, plan, batchNumber, count = 5) {
    const modules = plan.modules || [{ title: topic }];
    const questions = [];

    for (let i = 0; i < count; i++) {
      const qNum = (batchNumber - 1) * count + i + 1;
      const mod = modules[i % modules.length];

      questions.push({
        id: `q_${batchNumber}_${i + 1}`,
        moduleIndex: i % modules.length,
        moduleTitle: mod.title,
        question: `Question #${qNum}: In the context of ${mod.title}, what is the primary architectural trade-off?`,
        codeSnippet: i % 2 === 1 ? `// Example execution snippet for ${topic}\nconst result = await processPipeline({ mode: "async", batch: ${qNum} });` : '',
        options: [
          `Prioritizing high throughput and horizontal scalability at the cost of eventual consistency.`,
          `Sacrificing memory footprint to enforce synchronous thread-blocking execution.`,
          `Relying exclusively on monolithic state without cache invalidation guarantees.`,
          `Eliminating network overhead by disabling transport-layer encryption.`
        ],
        correctAnswerIndex: 0,
        explanation: `In distributed and modern systems, maximizing throughput and scalability commonly requires embracing eventual consistency over strict immediate lock synchronization.`,
        perplexityQuery: `Explain in depth the primary architectural trade-offs in ${mod.title} for ${topic}`
      });
    }

    return questions;
  }
}

window.aiService = new AIService();
