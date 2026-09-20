# 📱 DeepScroll Quiz - AI Doomscrolling Learning Feed

DeepScroll Quiz is a mobile-first, YouTube Shorts / TikTok-style infinite quiz app designed for hyper-learning. It transforms any topic into an engaging vertical swipe quiz powered by **Google Gemini** or **OpenRouter API** with one-tap **Perplexity AI** deep dives.

---

## 🚀 Live Demo & GitHub Pages Deployment

This project is **100% static client-side** and runs immediately on **GitHub Pages (`github.io`)** with zero server configuration!

### Quick Deployment to GitHub Pages:

#### Option 1: Using GitHub Web UI
1. Create a new repository on GitHub (e.g., `deepscroll-quiz`).
2. Push or upload these files to your repository:
   - `index.html`
   - `style.css`
   - `manifest.json`
   - `icon.svg`
   - `js/` directory (`api.js`, `quiz.js`, `plan.js`, `sound.js`, `app.js`)
3. Go to **Repository Settings** ⚙️ ➔ **Pages** (in the left sidebar).
4. Under **Branch**, select `main` (or `master`) and folder `/ (root)`, then click **Save**.
5. Your live app will be live at: `https://<your-username>.github.io/<repo-name>/`!

#### Option 2: Using Terminal (Git CLI)
```bash
git init
git add .
git commit -m "Initial commit - DeepScroll Quiz"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```
Then enable GitHub Pages under **Settings ➔ Pages**.

---

## ✨ Features

- 📱 **Mobile-First 100dvh Snap Scrolling**: True YouTube Shorts / TikTok vertical snap scroll mechanics using hardware-accelerated CSS scroll snap.
- ⚡ **Dual AI Provider Support**: Use your own **Google Gemini API Key** (Gemini 2.0 Flash / 1.5 Flash / Pro) or **OpenRouter Key** (Claude 3.5 Sonnet, DeepSeek Chat, Llama 3.3).
- 🧠 **Smart Curriculum Builder**: Generates an interactive, editable learning plan with milestones before you start quiz scrolling.
- 🔄 **Batched Prefetching (5-Question Batches)**: Automatically calls AI to pre-fetch the next batch in the background as soon as you reach the **4th question**.
- 💡 **One-Tap Perplexity Deep-Dive**: Dedicated `Ask Perplexity ↗` button on every card with custom URL query parameters (`https://www.perplexity.ai/search?q=...`) for instant research.
- 🔊 **Web Audio Synthesizer**: Zero-latency procedural sound effects for correct answers, mistakes, and streaks.
- 📑 **Saved Questions**: Bookmark any card to review later.
- 📲 **PWA Ready**: Tap "Add to Home Screen" on iOS Safari or Android Chrome to run as a fullscreen standalone app.

---

## 🔒 Privacy & API Key Security
All API keys and bookmarks are stored strictly inside your own browser's `localStorage`. No keys or user data are ever transmitted to any third-party intermediary servers.
