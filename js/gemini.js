// ==========================================================================
// DeepScroll Gemini Client (REST API Integration)
// ==========================================================================

class GeminiClient {
  async generateContent({ apiKey, model = 'gemini-2.0-flash', prompt, expectJSON = false, webSearch = false, logCallback }) {
    if (!apiKey) throw new Error('Google Gemini API Key is missing. Please enter it in Settings.');

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        maxOutputTokens: 2048,
        ...(expectJSON ? { responseMimeType: 'application/json' } : {})
      },
      ...(webSearch && !expectJSON ? { tools: [{ googleSearch: {} }] } : {})
    };

    const startTime = performance.now();
    let res, errData = null;

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

        if (logCallback) {
          logCallback({
            provider: 'Gemini',
            model: model,
            url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
            status: res.status,
            success: false,
            latency: latency,
            request: { endpoint: url.replace(apiKey, 'AIzaSy***[MASKED]'), body: body },
            response: { error: errorMsg, raw: errData }
          });
        }
        throw new Error(errorMsg);
      }

      const data = await res.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) throw new Error('Empty response from Gemini API');

      let parsedJSON = null;
      try { parsedJSON = JSON.parse(rawText); } catch(e) {}

      if (logCallback) {
        logCallback({
          provider: 'Gemini',
          model: model,
          url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          status: res.status,
          success: true,
          latency: latency,
          request: { endpoint: url.replace(apiKey, 'AIzaSy***[MASKED]'), body: body },
          response: { parsed: parsedJSON, raw: data }
        });
      }

      return rawText;
    } catch (err) {
      if (!res && logCallback) {
        logCallback({
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
}

window.geminiClient = new GeminiClient();
