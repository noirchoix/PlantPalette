# Palette

A SvelteKit + FastAPI web app for **plant and fruit classification** with integrated **color palette extraction**.

## Features

* **Plant Identification**: Upload one or more images to identify plant species using the [PlantNet](https://my.plantnet.org/) API.
* **LLM Boost**: Automatically boost low-confidence results (<80% confidence) using **OpenAI GPT-4 Vision** for image captioning.
* **Color Palette Extraction**: Extract dominant colors from uploaded images to create custom palettes.
* **Theme Testing**: Apply extracted colors to test areas (header, sidebar, content) in real-time.
* **Palette Export**: Download palettes in JSON or CSV formats.

## Tech Stack

* **Frontend**: [SvelteKit](https://kit.svelte.dev/) (TypeScript, Tailwind optional)
* **Backend**: [FastAPI](https://fastapi.tiangolo.com/)
* **External APIs**: PlantNet API, OpenAI GPT-4 Vision

## Project Structure

```
Palette/
├─ palette/               # SvelteKit frontend
│  ├─ src/
│  │  ├─ routes/+page.svelte  # Main UI
│  │  └─ lib/color/extract.ts # Color extraction logic
│  └─ ...
└─ server/                # FastAPI backend
   ├─ main.py             # PlantNet + OpenAI Vision endpoints
   └─ ...
```

## Setup

### Prerequisites

* Node.js 18+
* Python 3.10+
* Git
* API keys for:

  * [PlantNet](https://my.plantnet.org/account) (`PLANTNET_KEY`)
  * [OpenAI GPT-4 Vision](https://platform.openai.com/) (`OPENAI_API_KEY`)

### Installation

```bash
# Clone repo
git clone https://github.com/<your-username>/<your-repo>.git
cd Palette

# Frontend setup
cd palette
npm install

# Backend setup
cd ../server
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### Environment Variables

Create a `.env` file in the **server** folder with:

```
PLANTNET_KEY=your_plantnet_api_key
OPENAI_API_KEY=your_openai_api_key
```

### Running Locally

Start FastAPI backend:

```bash
cd server
uvicorn main:app --reload
```

Start SvelteKit frontend:

```bash
cd palette
npm run dev
```

The app will be available at **[http://localhost:5173](http://localhost:5173)** (frontend) and **[http://localhost:8000](http://localhost:8000)** (backend).

## Deployment

* **Frontend**: Vercel, Netlify, or any SvelteKit-compatible host.
* **Backend**: Render, Railway, or any FastAPI-compatible platform.

## License

MIT License. See `LICENSE` for details.
