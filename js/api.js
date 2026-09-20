// ==========================================================================
// DeepScroll AI Service (Google Gemini & OpenRouter Unified Client)
// ==========================================================================

class AIService {
  constructor() {
    this.provider = localStorage.getItem('ds_api_provider') || 'gemini';
    this.geminiKey = localStorage.getItem('ds_gemini_key') || '';
    this.openRouterKey = localStorage.getItem('ds_openrouter_key') || '';
    this.openRouterModel = localStorage.getItem('ds_openrouter_model') || 'google/gemini-2.0-flash-exp:free';
    this.cachedOpenRouterModels = JSON.parse(localStorage.getItem('ds_cached_or_models') || '[]');
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
    if (this.logs.length > 50) this.logs.pop(); // keep last 50 calls
    console.log(`[DeepScroll AI Log ${logItem.type}]`, logItem);
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
    const result = await this.callAI(prompt, true, 'TEST_CONNECTION');
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
      throw new Error(`No ${this.provider === 'gemini' ? 'Google Gemini' : 'OpenRouter'} API Key found. Please tap Settings (⚙️) and enter your API key to generate real AI plans.`);
    }

    const systemPrompt = `You are an expert curriculum designer and educator. The user wants to learn: "${topic}" at a "${difficulty}" level.
Create a high-impact, focused learning curriculum composed of 4 to 6 sequential learning modules.
For each module, assign an appropriate target number of quiz questions (e.g. between 3 and 8 questions, defaulting to 5).

IMPORTANT: Return ONLY a valid JSON object matching this schema without any markdown commentary:
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

    const response = await this.callAI(systemPrompt, true, `PLAN_GEN: ${topic}`);
    const parsed = this.cleanAndParseJSON(response);
    if (parsed && Array.isArray(parsed.modules) && parsed.modules.length > 0) {
      return parsed;
    }
    throw new Error('AI returned an unexpected format. Please check the logs (📟) or try again.');
  }

  // Generate a Batch of 5 Questions based on Learning Plan
  async generateQuestionBatch(topic, plan, batchNumber = 1, count = 5, previousQuestions = []) {
    if (!this.hasValidKey()) {
      throw new Error(`No ${this.provider === 'gemini' ? 'Google Gemini' : 'OpenRouter'} API Key found. Please add your key in Settings (⚙️).`);
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

IMPORTANT: Return ONLY a valid JSON object matching this exact structure with NO markdown formatting:
{
  "batch": ${batchNumber},
  "questions": [
    {
      "id": "q_${batchNumber}_1",
      "moduleIndex": 0,
      "moduleTitle": "Name of relevant module",
      "question": "Clear, engaging question prompt?",
      "codeSnippet": "",
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

    const response = await this.callAI(prompt, true, `BATCH_GEN #${batchNumber}: ${topic}`);
    const parsed = this.cleanAndParseJSON(response);
    if (parsed && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
      return parsed.questions;
    }
    throw new Error('AI returned an unparseable batch response. Check the Logs (📟) for details.');
  }

  // Core AI Dispatcher
  async callAI(prompt, expectJSON = false, callType = 'AI_CALL') {
    if (this.provider === 'gemini') {
      return this.callGemini(prompt, expectJSON, callType);
    } else {
      return this.callOpenRouter(prompt, expectJSON, callType);
    }
  }

  // Gemini API Implementation
  async callGemini(prompt, expectJSON, callType = 'GEMINI_CALL') {
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

    const startTime = performance.now();
    let res, errData = null, rawText = null;

    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const latency = Math.round(performance.now() - startTime);

      if (!res.ok) {
        errData = await res.text();
        let errorMsg = `Gemini API Error (${res.status})`;
        try {
          const errJson = JSON.parse(errData);
          errorMsg = errJson.error?.message || errorMsg;
        } catch (e) {}

        this.addLog({
          type: callType,
          provider: 'Gemini',
          model: model,
          url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          status: res.status,
          success: false,
          latency: latency,
          request: {
            endpoint: url.replace(this.geminiKey, 'AIzaSy***[MASKED]'),
            body: body
          },
          response: { error: errorMsg, raw: errData }
        });

        throw new Error(errorMsg);
      }

      const data = await res.json();
      const candidate = data.candidates?.[0];
      rawText = candidate?.content?.parts?.[0]?.text;
      if (!rawText) throw new Error('Empty response from Gemini API');

      let parsedJSON = null;
      try { parsedJSON = JSON.parse(rawText); } catch(e) {}

      this.addLog({
        type: callType,
        provider: 'Gemini',
        model: model,
        url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        status: res.status,
        success: true,
        latency: latency,
        request: {
          endpoint: url.replace(this.geminiKey, 'AIzaSy***[MASKED]'),
          body: body
        },
        response: {
          parsed: parsedJSON,
          raw: data
        }
      });

      return rawText;
    } catch (err) {
      if (!res) {
        this.addLog({
          type: callType,
          provider: 'Gemini',
          model: model,
          status: 'NETWORK_ERR',
          success: false,
          latency: Math.round(performance.now() - startTime),
          request: { body: body },
          response: { error: err.message }
        });
      }
      throw err;
    }
  }

  // OpenRouter API Implementation with Auto-Retry on unsupported parameters
  async callOpenRouter(prompt, expectJSON, callType = 'OPENROUTER_CALL', isRetry = false) {
    if (!this.openRouterKey) throw new Error('OpenRouter API Key is missing. Please enter it in Settings.');

    const model = this.openRouterModel || 'google/gemini-2.0-flash-exp:free';
    const url = 'https://openrouter.ai/api/v1/chat/completions';

    // System prompt guarantees JSON even without response_format
    const systemPrompt = expectJSON
      ? 'You are an expert AI. You MUST respond with ONLY a raw valid JSON object. Do not wrap in markdown or backticks. Do not include introductory text.'
      : 'You are a helpful AI assistant.';

    const body = {
      model: model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 2048,
      ...((expectJSON && !isRetry) ? { response_format: { type: 'json_object' } } : {}),
      ...((this.webSearchEnabled && !isRetry) ? {
        tools: [
          { type: 'openrouter:web_search' }
        ]
      } : {})
    };

    const startTime = performance.now();
    let res, errData = null;

    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.openRouterKey}`
        },
        body: JSON.stringify(body)
      });

      const latency = Math.round(performance.now() - startTime);

      if (!res.ok) {
        errData = await res.text();
        let errorMsg = `OpenRouter API Error (${res.status})`;
        try {
          const errJson = JSON.parse(errData);
          errorMsg = errJson.error?.message || errorMsg;
        } catch (e) {}

        // If error is 400 and we passed tools or response_format, auto-retry without them!
        if (res.status === 400 && !isRetry && (this.webSearchEnabled || expectJSON)) {
          console.warn(`[OpenRouter] Model ${model} returned 400 on tools/response_format. Auto-retrying cleanly...`);
          return this.callOpenRouter(prompt, expectJSON, callType, true);
        }

        this.addLog({
          type: callType,
          provider: 'OpenRouter',
          model: model,
          url: url,
          status: res.status,
          success: false,
          latency: latency,
          request: {
            url: url,
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer sk-or-***[MASKED]' },
            body: body
          },
          response: { error: errorMsg, raw: errData }
        });

        throw new Error(errorMsg);
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error('Empty response from OpenRouter API');

      let parsedJSON = null;
      try { parsedJSON = this.cleanAndParseJSON(content); } catch(e) {}

      this.addLog({
        type: callType,
        provider: 'OpenRouter',
        model: model,
        url: url,
        status: res.status,
        success: true,
        latency: latency,
        request: {
          url: url,
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer sk-or-***[MASKED]' },
          body: body
        },
        response: {
          parsed: parsedJSON,
          raw: data
        }
      });

      return content;
    } catch (err) {
      if (!res) {
        this.addLog({
          type: callType,
          provider: 'OpenRouter',
          model: model,
          status: 'NETWORK_ERR',
          success: false,
          latency: Math.round(performance.now() - startTime),
          request: { body: body },
          response: { error: err.message }
        });
      }
      throw err;
    }
  }

  // Robust JSON Extraction helper
  cleanAndParseJSON(rawText) {
    if (!rawText) return null;
    let cleaned = rawText.trim();

    // 1. If wrapped in markdown code fence (```json ... ``` or ``` ...)
    const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch && codeBlockMatch[1]) {
      cleaned = codeBlockMatch[1].trim();
    }

    // 2. Direct parse attempt
    try {
      return JSON.parse(cleaned);
    } catch (e) {}

    // 3. Extract JSON between the outermost { and }
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const candidate = cleaned.substring(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(candidate);
      } catch (e2) {
        // Try fixing simple trailing commas before closing braces
        try {
          const sanitized = candidate.replace(/,\s*([\]}])/g, '$1');
          return JSON.parse(sanitized);
        } catch (e3) {}
      }
    }

    return null;
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

  // Dynamic Mock Batch Generator (with varied question types and unique options)
  getMockBatch(topic, plan, batchNumber, count = 5) {
    const modules = plan.modules || [{ title: topic }];
    const questions = [];

    const questionTemplates = [
      {
        q: (t, m) => `What is the core purpose of ${m.title} when mastering ${t}?`,
        opts: (t, m) => [
          `Establishing robust mental models and standardizing core operations across the system.`,
          `Bypassing data validation layers to maximize raw throughput at any cost.`,
          `Enforcing strict monolithic dependencies to prevent horizontal distributed scaling.`,
          `Disabling asynchronous processing in favor of blocking thread execution.`
        ],
        ans: 0,
        exp: (t, m) => `In ${t}, mastering ${m.title} provides the foundational architectural guarantees necessary for scalable and predictable execution.`
      },
      {
        q: (t, m) => `Which strategy best prevents performance bottlenecks in ${m.title}?`,
        opts: (t, m) => [
          `Allocating unbounded global memory without garbage collection constraints.`,
          `Implementing intelligent caching, backpressure, and asynchronous decoupled workflows.`,
          `Polling state synchronously in an infinite tight loop without timeouts.`,
          `Hardcoding static thread pools with no elasticity or circuit breakers.`
        ],
        ans: 1,
        exp: (t, m) => `Decoupling workloads with caching, backpressure, and non-blocking I/O is critical to avoid single-point bottlenecks.`
      },
      {
        q: (t, m) => `What is a critical anti-pattern to avoid when implementing ${m.title}?`,
        opts: (t, m) => [
          `Writing automated integration tests for edge-case boundaries.`,
          `Leveraging declarative configuration pipelines and observability metrics.`,
          `Tightly coupling distributed components and ignoring transient network partition failures.`,
          `Utilizing exponential backoff and idempotency keys for distributed retries.`
        ],
        ans: 2,
        exp: (t, m) => `Assuming network reliability and tightly coupling micro-components creates cascading failures in modern distributed systems.`
      },
      {
        q: (t, m) => `How does modern production architecture handle state in ${m.title}?`,
        opts: (t, m) => [
          `Storing all persistent state inside volatile in-memory container registers.`,
          `Relying on synchronous file locks across multi-region server clusters.`,
          `Writing unindexed raw log files to disk on every single user interaction.`,
          `Employing event-driven state streams with immutable logs and snapshot checkpointing.`
        ],
        ans: 3,
        exp: (t, m) => `Immutable event logs combined with snapshot checkpointing ensure reliable recovery, replayability, and horizontal audit trails.`
      },
      {
        q: (t, m) => `When scaling ${m.title} under high concurrency, what trade-off must be evaluated?`,
        opts: (t, m) => [
          `Trading off immediate strong consistency for high availability and low latency.`,
          `Sacrificing security encryption to gain minimal CPU instruction savings.`,
          `Replacing distributed caches with synchronous relational database locking.`,
          `Eliminating load balancers to route all traffic to a single leader node.`
        ],
        ans: 0,
        exp: (t, m) => `According to the CAP theorem and distributed systems theory, high throughput and availability often require embracing eventual consistency.`
      }
    ];

    for (let i = 0; i < count; i++) {
      const qNum = (batchNumber - 1) * count + i + 1;
      const mod = modules[i % modules.length];
      const template = questionTemplates[i % questionTemplates.length];

      questions.push({
        id: `q_${batchNumber}_${i + 1}`,
        moduleIndex: i % modules.length,
        moduleTitle: mod.title,
        question: `[#${qNum}] ${template.q(topic, mod)}`,
        codeSnippet: i % 2 === 1 ? `// Example ${topic} Implementation Pattern\nconst execution = await processPipeline({\n  module: "${mod.title.replace(/"/g, '')}",\n  stage: ${qNum},\n  concurrency: "adaptive"\n});` : '',
        options: template.opts(topic, mod),
        correctAnswerIndex: template.ans,
        explanation: template.exp(topic, mod),
        perplexityQuery: `Explain in detail ${template.q(topic, mod)} for ${topic}`
      });
    }

    return questions;
  }
}

window.aiService = new AIService();
