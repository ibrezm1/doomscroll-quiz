// ==========================================================================
// DeepScroll AI Service (Google Gemini & OpenRouter Unified Client)
// ==========================================================================

class AIService {
  constructor() {
    this.provider = localStorage.getItem('ds_api_provider') || 'gemini';
    this.geminiKey = localStorage.getItem('ds_gemini_key') || '';
    this.openRouterKey = localStorage.getItem('ds_openrouter_key') || '';
    this.geminiModel = localStorage.getItem('ds_gemini_model') || 'gemini-2.0-flash';
    this.openRouterModel = localStorage.getItem('ds_openrouter_model') || 'google/gemini-2.0-flash-001';
  }

  saveConfig({ provider, geminiKey, openRouterKey, geminiModel, openRouterModel }) {
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

  // Test API Connection
  async testConnection() {
    const prompt = 'Respond with JSON: {"status": "ok", "message": "connected"}';
    const result = await this.callAI(prompt, true);
    return result;
  }

  // Generate Learning Plan from Topic
  async generateLearningPlan(topic, difficulty = 'Intermediate') {
    if (!this.hasValidKey()) {
      return this.getMockPlan(topic, difficulty);
    }

    const systemPrompt = `You are an expert curriculum designer and educator. The user wants to learn: "${topic}" at a "${difficulty}" level.
Create a high-impact, focused learning curriculum composed of 4 to 6 sequential learning modules.

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
      "keyConcepts": ["Concept 1", "Concept 2", "Concept 3"]
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
      }
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

    const model = this.openRouterModel || 'google/gemini-2.0-flash-001';
    const url = 'https://openrouter.ai/api/v1/chat/completions';

    const body = {
      model: model,
      messages: [
        { role: 'system', content: expectJSON ? 'You are an AI that outputs strictly valid JSON without markdown formatting.' : 'You are a helpful AI assistant.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 2048,
      ...(expectJSON ? { response_format: { type: 'json_object' } } : {})
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.openRouterKey}`,
        'HTTP-Referer': window.location.origin || 'http://localhost',
        'X-Title': 'DeepScroll Quiz'
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
          keyConcepts: ['Core Architecture', 'Key Definitions', 'Mental Models']
        },
        {
          id: 2,
          title: `Mechanisms & Under-the-Hood Operations`,
          summary: `Understand how the system executes, coordinates state, and processes data internally.`,
          keyConcepts: ['State Management', 'Execution Lifecycle', 'Data Flow']
        },
        {
          id: 3,
          title: `Common Pitfalls & Edge Cases`,
          summary: `Analyze common failure modes, performance bottlenecks, and debugging techniques.`,
          keyConcepts: ['Anti-Patterns', 'Performance Bottlenecks', 'Error Handling']
        },
        {
          id: 4,
          title: `Advanced Strategies & Real-World Application`,
          summary: `Apply enterprise best practices, scalable design patterns, and optimization techniques.`,
          keyConcepts: ['Scalability', 'Security & Best Practices', 'Production Patterns']
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
