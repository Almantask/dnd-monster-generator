# 🐉 The Bestiary

A D&D 5e monster workshop: conjure AI-crafted creatures, hand-scribe custom statblocks, view authentic parchment sheets, and roll interactive 3D physics dice directly from the statblock.

🌐 **Live Website**: [https://bestiary-api-4klhpyohsa-uc.a.run.app/](https://bestiary-api-4klhpyohsa-uc.a.run.app/)  
📖 **GitHub Pages (Alternative)**: [https://almantask.github.io/dnd-monster-generator/](https://almantask.github.io/dnd-monster-generator/)

---

## ✨ Features

- **🧙 AI Monster Conjuration**: Generate balanced D&D 5e statblocks by party size, level, and difficulty (Trivial to Deadly) with rich lore, traits, actions, and legendary actions.
- **🎨 AI Portrait Generation**: Generates painted parchment-style monster portraits powered by Google AI Studio (Gemini 2.5 Flash Image) with Pollinations FLUX and Hugging Face fallbacks.
- **🎲 Interactive 3D Physics Dice Box**: Click any stat, attack roll (`+N to hit`), damage formula (`2d6+3`), saving throw, or recharge ability to roll authentic 3D dice powered by Three.js and Rapier3D physics.
- **📜 Scribe & Statblock Editor**: Full manual creation and editing of custom monsters with live statblock preview, calculation helpers, and JSON paste validation.
- **📚 Local Bestiary Library**: Search, filter, and organize your creations. Data is stored privately on your device via IndexedDB (Dexie).
- **📦 Backup, Import & Export**: Export monsters as JSON or download your entire bestiary with high-res portraits as a `.zip` archive.

---

## 📖 Quick User Guide

### 1. Conjuring a Monster
1. Navigate to **[Conjure](https://bestiary-api-4klhpyohsa-uc.a.run.app/#/conjure)**.
2. Enter a creature name and a thematic description or concept.
3. Select your **Party Size**, **Average Level**, and desired **Difficulty** (e.g. Medium, Deadly).
4. Click **Conjure Monster** — the AI will generate the statblock and painted portrait.
5. Review the result, make manual tweaks if needed, and save it to your Bestiary.

### 2. Rolling Dice from the Statblock
- Click on any **Ability Score** or **Modifier** to roll a d20 check.
- Click on any **Attack Bonus** (e.g., `+7 to hit`) to roll an attack.
- Click on any **Damage Expression** (e.g., `2d10 + 4 fire damage`) to roll damage dice.
- Click on **Recharge** text (e.g., `Recharge 5–6`) to roll for recharge.
- Dice roll with real-time physics in the 3D dice overlay tray!

### 3. Scribing & Editing
- Go to **[Scribe](https://bestiary-api-4klhpyohsa-uc.a.run.app/#/scribe)** to handcraft a monster from scratch or edit an existing one.
- Use the **Paste JSON** tab to import existing statblock data or raw JSON directly.

### 4. Backing Up Your Monsters
- On the **[Bestiary](https://bestiary-api-4klhpyohsa-uc.a.run.app/#/)** page, use the export buttons to save individual monsters or download a complete `.zip` backup containing all data and artwork.

---

## 🛠️ Local Development

### Prerequisites
- Node.js 22+
- (Optional) Free API key from [OpenRouter](https://openrouter.ai/) for LLM generation
- (Optional) Free API key from [Google AI Studio](https://aistudio.google.com/apikey) for portrait generation

### Setup & Run

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your API keys (OpenRouter / Gemini)

# 3. Start local development (runs UI on :5173 and API on :8080)
npm run dev:all
```

Open `http://localhost:5173` in your browser.

### Quality Checks & Testing

```bash
npm test            # Run Vitest test suite
npm run typecheck   # Validate TypeScript types
npm run lint        # Fast Oxlint code analysis
npm run build       # Verify production bundle build
```

---

## 🚀 Deployment

The project is configured for one-click deployment to **Google Cloud Run**:

- **Continuous Deployment (CI/CD)**: Push to `main` triggers [.github/workflows/cloud-run.yml](.github/workflows/cloud-run.yml), validating tests and deploying to Cloud Run.
- **Detailed Instructions**: See [host_plan.md](host_plan.md) for Google Cloud credits, IAM service accounts, Secret Manager, and GitHub Secrets configuration.
