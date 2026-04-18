# 🌮 Mi Vocabulario — Spanish Vocab Tracker

A Spanish vocabulary learning app built with React, powered by Claude AI.

## Features
- 📖 Word list with known/learning tracking
- 🃏 Flashcards
- 🔀 Conjugation quizzer (Present, Past, Present Perfect)
- 📄 Interactive transcript reader — tap any word to look it up
- ➕ Add words manually with auto-translation

## Setup 

1. Clone the repo :
   ```
   git clone https://github.com/judylau/spanish-vocab-app.git
   cd spanish-vocab-app
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file:
   ```
   VITE_ANTHROPIC_API_KEY=your_key_here
   ```
   Get your key at https://console.anthropic.com

4. Run locally:
   ```
   npm run dev
   ```

## Deploy to GitHub Pages

1. Go to your repo → **Settings → Secrets and variables → Actions**
2. Add a secret named `VITE_ANTHROPIC_API_KEY` with your Anthropic API key
3. Go to **Settings → Pages** and set Source to **GitHub Actions**
4. Push to `main` — the app will build and deploy automatically

Live URL: https://judylau.github.io/spanish-vocab-app/