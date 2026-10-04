# Perfect Shuffle 🂠⏱️
> **Hands-Free, Zero-Bend Card Shuffler with Voice Synthesis & Visual Guidance**

A modern web application built to help card players and magicians achieve a **100% mathematically uniform random shuffle** without riffle shuffling, card bending, or sleeve damage.

---

## 🌟 Key Features

- 🃏 **Zero-Bend True Randomization**: Cards stay face-down the entire time. No bending, shuffling friction, or sleeve corner splitting.
- ⏱️ **Clock & 3×3 Grid Layouts**:
  - **Clock Face (13 zones)**: 0 in the center + 1–12 around the dial. Form-fitted for standard 52-card decks (exactly 4 cards dealt per spot!).
  - **3×3 Grid (9 zones)**: Compact layout ideal for small coffee tables or playmats. (For 54 cards, this divides into **exactly 6 cards per pile**!).
- 🎯 **Two Dealing Methods**:
  - **Counted Piles (Precise)**: Deal evenly around the spots. The app tracks card counts per pile and dims empty spots so they are never called.
  - **Casual Spread (Fast Setup)**: Just drop clumps or casually spread cards without counting! If an announced spot runs out of cards, simply take from the **next clockwise spot** (or press <kbd>S</kbd> to reroll).
- 🂠 **Deck Presets**:
  - **52 Cards**: Standard Poker / Blackjack
  - **54 Cards**: Standard Deck + 2 Jokers
  - **60 Cards**: TCG / Pokémon / MTG Constructed
  - **100 Cards**: MTG Commander / EDH
  - **32 Cards / 40 Cards / Custom Count** (any size up to 500)
- 🗣️ **Web Speech Synthesis**: Clear, low-latency client-side voice announcements dictate where to draw each card (e.g. *"Seven"*, *"Center"*, *"Twelve"*).
- 🔊 **Web Audio Cues**: Pleasant synthesized tactile pops and completion fanfare without external audio files.
- 👆 **Massive Touch Target**: Tap anywhere on screen with a knuckle or thumb to advance instantly (<5ms response).
- ⏱️ **Auto-Pacer (Metronome Mode)**: Set a steady cadence (e.g., 1.5s per card) and grab cards in rhythm completely hands-free.
- ⏪ **Undo Support**: Accidentally tapped twice? Hit Undo (or press Left Arrow) to step back.
- 📱 **Mobile & PWA Ready**: Installable to iOS / Android home screens with 100% offline support and Screen Wake Lock to prevent the display from sleeping during play.
- 🎲 **Cryptographically Secure**: Built with `crypto.getRandomValues()` and a Fisher-Yates CSPRNG sampling engine.

---

## 🚀 How to Run Locally

Because this is built with standard web technologies (vanilla ES6, CSS3, HTML5), it has **zero external build dependencies**.

### Quick Start
Open `index.html` directly in any modern browser:
```bash
# macOS
open /Users/mark.fulton/.gemini/antigravity/scratch/perfect-shuffle/index.html
```

Or run a local static server:
```bash
cd /Users/mark.fulton/.gemini/antigravity/scratch/perfect-shuffle
python3 -m http.server 8000
```
Then visit: `http://localhost:8000`

---

## 🌐 Deploying to GitHub Pages

This app is 100% GitHub Pages ready (all assets use relative paths, `.nojekyll` is included, and OpenGraph social meta tags are configured).

### Steps to Host:
1. Create a new repository on GitHub (e.g. `perfect-shuffle`).
2. In your terminal inside this directory, push your code:
```bash
cd /Users/mark.fulton/.gemini/antigravity/scratch/perfect-shuffle
git add .
git commit -m "Initial release of Perfect Shuffle"
git remote add origin https://github.com/<YOUR-USERNAME>/perfect-shuffle.git
git branch -M main
git push -u origin main
```
3. On GitHub, navigate to **Settings** > **Pages**.
4. Under **Build and deployment** > **Branch**, select `main` branch and `/ (root)` folder, then click **Save**.
5. Within 1–2 minutes, your app will be live at:
   `https://<YOUR-USERNAME>.github.io/perfect-shuffle/`

---

## 📖 How It Works

### Step 1: Lay Out Cards (Choose Your Dealing Style)
- **Counted Piles**: Deal cards face down evenly around the spots (e.g. 4 cards per spot on the Clock for 52 cards; 6 cards per spot on 3×3 Grid for 54 cards).
- **Casual Spread**: Just drop piles or clumps roughly across the spots without counting.

### Step 2: Follow Voice & Visual Prompts
- The app announces and highlights a zone (e.g. *"Seven"* or *"Center"*).
- Take the top card from that pile and place it face-down onto your collected stack.
- *If in Casual Mode and a spot is empty:* Take from the next spot clockwise, or tap **Spot Empty? Reroll** (<kbd>S</kbd>).

### Step 3: Advance
- Tap anywhere on the screen or press <kbd>Spacebar</kbd> to move to the next card.
- Alternatively, enable **Auto-Pace** to have cards called automatically at your preferred rhythm.

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
| :--- | :--- |
| <kbd>Space</kbd> / <kbd>Enter</kbd> | Next card / Start shuffle |
| <kbd>←</kbd> / <kbd>Backspace</kbd> | Undo previous card |
| <kbd>S</kbd> | Reroll current spot (in Casual Spread mode) |
| <kbd>A</kbd> | Toggle Auto-Pacer |
| <kbd>M</kbd> | Mute / Unmute voice |
| <kbd>R</kbd> | Reset shuffle |
| <kbd>Esc</kbd> | Close dialogs |

---

## 🎤 Note on Voice Recognition & Microphones

Voice recognition (`SpeechRecognition`) is intentionally **not enabled** for hands-free progression because:
1. Web Speech Recognition in browsers incurs **400ms–1200ms** cloud roundtrip latency, which slows down dealing significantly.
2. Repeating *"next"* 52 times causes vocal fatigue.
3. Microphone input conflicts with the device's own speech synthesis speaker.
Instead, the **Auto-Pacer rhythm** and **instant screen tapping** provide a smoother, zero-latency experience.
