// ==========================================================================
// DeepScroll OpenRouter Client (Models Fetching & Structured Outputs)
// ==========================================================================

class OpenRouterClient {
  async fetchModels(forceRefresh = false) {
    const cached = JSON.parse(localStorage.getItem('ds_cached_or_models') || '[]');
    if (!forceRefresh && cached.length > 0) return cached;

    try {
      const res = await fetch('https://openrouter.ai/api/v1/models', {
        method: 'GET',
        mode: 'cors'
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} fetching models`);
      const data = await res.json();
      const rawList = data.data || [];

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

      processed.sort((a, b) => {
        if (a.isFree && !b.isFree) return -1;
        if (!a.isFree && b.isFree) return 1;
        return a.name.localeCompare(b.name);
      });

      localStorage.setItem('ds_cached_or_models', JSON.stringify(processed));
      return processed;
    } catch (err) {
      console.warn('Could not fetch OpenRouter models:', err);
      return cached.length > 0 ? cached : this.getDefaultModels();
    }
  }

  getDefaultModels() {
    return [
      { id: 'google/gemini-2.0-flash-exp:free', name: 'Google: Gemini 2.0 Flash Exp (free)', isFree: true },
      { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Meta: Llama 3.3 70B Instruct (free)', isFree: true },
      { id: 'deepseek/deepseek-r1:free', name: 'DeepSeek: R1 (free)', isFree: true },
      { id: 'mistralai/mistral-7b-instruct:free', name: 'Mistral 7B Instruct (free)', isFree: true },
      { id: 'anthropic/claude-3.5-sonnet', name: 'Anthropic: Claude 3.5 Sonnet', isFree: false }
    ];
  }

  async generateChat({ apiKey, model = 'google/gemini-2.0-flash-exp:free', prompt, expectJSON = false, jsonSchema = null, webSearch = false, logCallback, isRetry = false }) {
    if (!apiKey) throw new Error('OpenRouter API Key is missing. Please enter it in Settings.');

    const url = 'https://openrouter.ai/api/v1/chat/completions';
    const systemPrompt = expectJSON
      ? 'You are an expert AI. You MUST respond with ONLY a raw valid JSON object matching the requested schema. Do not wrap in markdown or backticks.'
      : 'You are a helpful AI assistant.';

    // Construct response_format for Structured Outputs
    let responseFormat = undefined;
    if (expectJSON && !isRetry) {
      if (jsonSchema) {
        responseFormat = {
          type: 'json_schema',
          json_schema: jsonSchema
        };
      } else {
        responseFormat = { type: 'json_object' };
      }
    }

    const body = {
      model: model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 3000,
      ...(responseFormat ? { response_format: responseFormat } : {}),
      ...((webSearch && !isRetry) ? { tools: [{ type: 'openrouter:web_search' }] } : {})
    };

    const startTime = performance.now();
    let res, errData = null;

    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
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

        // Auto-retry cleanly if model doesn't support json_schema or tools (HTTP 400)
        if (res.status === 400 && !isRetry && (webSearch || expectJSON)) {
          console.warn(`[OpenRouter] Model ${model} returned 400 on json_schema/tools. Auto-retrying cleanly...`);
          return this.generateChat({ apiKey, model, prompt, expectJSON, jsonSchema: null, webSearch: false, logCallback, isRetry: true });
        }

        if (logCallback) {
          logCallback({
            provider: 'OpenRouter',
            model: model,
            url: url,
            status: res.status,
            success: false,
            latency: latency,
            request: { url: url, body: body },
            response: { error: errorMsg, raw: errData }
          });
        }
        throw new Error(errorMsg);
      }

      const data = await res.json();
      const choice = data.choices?.[0];
      let content = choice?.message?.content;
      if (!content && choice?.text) content = choice.text;
      if (!content && choice?.message?.reasoning) content = choice.message.reasoning;
      if (Array.isArray(content)) {
        content = content.map(p => (typeof p === 'string' ? p : p.text || '')).join('\n');
      }

      if (!content) {
        if (!isRetry && expectJSON) {
          console.warn(`[OpenRouter] Empty content with json_schema on ${model}. Retrying in standard mode...`);
          return this.generateChat({ apiKey, model, prompt, expectJSON, jsonSchema: null, webSearch: false, logCallback, isRetry: true });
        }
        throw new Error('Empty response from OpenRouter API. Please try a different model or retry.');
      }

      let parsedJSON = null;
      try { parsedJSON = JSON.parse(content); } catch (e) {}

      if (logCallback) {
        logCallback({
          provider: 'OpenRouter',
          model: model,
          url: url,
          status: res.status,
          success: true,
          latency: latency,
          request: { url: url, body: body },
          response: { parsed: parsedJSON, raw: data }
        });
      }

      return content;
    } catch (err) {
      if (!res && logCallback) {
        logCallback({
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
}

window.openRouterClient = new OpenRouterClient();
