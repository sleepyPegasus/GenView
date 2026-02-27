# GenView

Enterprise AI application for generating industrial admin dashboards, data panels, and architecture diagrams via natural language. Similar in concept to v0.dev / Claude Artifacts, but tailored for ToB (Business-to-Business) management scenarios.

## Features

- **Natural Language to UI** - Describe your dashboard in plain language, get a live React component
- **Split-View Interface** - 35% chat panel (left) + 65% render canvas (right)
- **Live Preview** - Sandpack-powered in-browser React rendering with App Shell injection
- **Architecture Diagrams** - Mermaid.js integration for generating flowcharts, sequence diagrams, etc.
- **4 Industrial Themes** - Modern B2B, Dark Dashboard, Steel Metallurgy, Wind Energy
- **Model-Agnostic LLM** - Searchable model selector with all OpenRouter models
- **Multi-Turn Conversations** - Context-aware code iteration with conversation history
- **Code View** - Syntax-highlighted source code alongside live preview

## Tech Stack

### Frontend
- **Next.js 16** (App Router + Turbopack)
- **React 19** + TypeScript
- **Tailwind CSS v4**
- **Vercel AI SDK v6** (`@ai-sdk/react` with `TextStreamChatTransport`)
- **Zustand** - Global state management
- **Sandpack** - In-browser React component preview
- **Mermaid.js** - Architecture diagram rendering
- **Recharts** - Charting library (available inside generated components)
- **Lucide React** - Icon library

### Backend
- **Python 3.10+** with **FastAPI**
- **SQLAlchemy 2.0** (async) + **asyncpg** for PostgreSQL
- **httpx** + **httpx-sse** for OpenRouter streaming
- **Pydantic v2** for request/response validation

## Project Structure

```
GenView/
├── backend/                    # Python FastAPI backend
│   ├── app/
│   │   ├── main.py             # FastAPI app, lifespan, CORS
│   │   ├── config.py           # Pydantic Settings
│   │   ├── database.py         # Async SQLAlchemy engine + sessions
│   │   ├── models.py           # ORM models (Project, Conversation, Message)
│   │   ├── schemas.py          # Pydantic request/response schemas
│   │   └── routers/
│   │       ├── chat.py         # POST /api/chat (streaming)
│   │       ├── projects.py     # CRUD /api/projects
│   │       ├── conversations.py# CRUD /api/conversations
│   │       └── models_router.py# GET /api/models (OpenRouter proxy)
│   ├── requirements.txt
│   └── .env.example
├── src/                        # Next.js frontend
│   ├── app/
│   │   ├── page.tsx            # Main split-view layout
│   │   ├── layout.tsx          # Root layout
│   │   └── globals.css         # Theme CSS variables
│   ├── components/
│   │   ├── chat/
│   │   │   ├── chat-panel.tsx  # Chat UI with AI SDK useChat
│   │   │   └── settings-panel.tsx # App name, theme, nav layout config
│   │   ├── canvas/
│   │   │   ├── render-canvas.tsx    # Preview/Code tab switcher
│   │   │   ├── sandpack-preview.tsx # Sandpack live preview
│   │   │   └── mermaid-preview.tsx  # Mermaid diagram renderer
│   │   └── ui/                 # Reusable UI primitives
│   │       ├── button.tsx
│   │       ├── input.tsx
│   │       ├── select.tsx
│   │       ├── textarea.tsx
│   │       └── model-selector.tsx  # Searchable OpenRouter model picker
│   ├── lib/
│   │   ├── code-parser.ts     # Extract tsx/mermaid from LLM output
│   │   ├── message-utils.ts   # UIMessage text extraction helper
│   │   ├── sandpack-files.ts  # App Shell file generation
│   │   ├── themes.ts          # Theme token definitions
│   │   └── utils.ts           # cn() utility
│   └── store/
│       └── app-store.ts       # Zustand global state
├── next.config.ts              # API rewrites to Python backend
├── package.json
└── .env.example
```

## Getting Started

### Prerequisites

- **Node.js** >= 18
- **Python** >= 3.10
- **PostgreSQL** >= 14
- **OpenRouter API Key** - Get one at [openrouter.ai](https://openrouter.ai)

### 1. Clone & Install Frontend

```bash
git clone <repo-url> GenView
cd GenView
npm install
```

### 2. Set Up Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Configure Environment Variables

**Backend** (`backend/.env`):
```env
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/genview
OPENROUTER_API_KEY=your-openrouter-api-key-here
CORS_ORIGINS=["http://localhost:3000"]
```

**Frontend** (`.env`):
```env
BACKEND_URL=http://localhost:8000
```

### 4. Set Up Database

```bash
# Create the PostgreSQL database
createdb genview

# Tables are auto-created on backend startup via SQLAlchemy
```

### 5. Run the Application

Start both services in separate terminals:

```bash
# Terminal 1 - Backend (port 8000)
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000

# Terminal 2 - Frontend (port 3000)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## How It Works

1. **User describes a dashboard** in the chat panel (e.g., "Create a sales dashboard with a revenue chart and KPI cards")
2. **Backend streams LLM response** from OpenRouter with a specialized system prompt that instructs the model to generate a `DashboardContent.tsx` React component
3. **Code parser** extracts `tsx` or `mermaid` code blocks from the streaming response
4. **Sandpack preview** renders the component inside an App Shell that provides sidebar/top-nav layout, theme CSS variables, and pre-configured dependencies (Recharts, Lucide icons)
5. **Mermaid preview** renders architecture diagrams when the model outputs mermaid blocks
6. **Multi-turn iteration** - users can refine the generated component through follow-up messages, with the current code injected as context

## Themes

| Theme | Description |
|-------|-------------|
| `modern-b2b` | Clean blue/white enterprise look |
| `dark-dashboard` | Dark mode with neon accents |
| `steel-metallurgy` | Industrial warm tones |
| `wind-energy` | Green energy-inspired palette |

Themes are applied via CSS custom properties on a `data-theme` attribute and propagated into the Sandpack preview.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/chat` | Stream chat completion from OpenRouter |
| `GET` | `/api/models` | List available OpenRouter models (5min cache) |
| `GET/POST` | `/api/projects` | List / create projects |
| `GET/PATCH/DELETE` | `/api/projects/:id` | Get / update / delete a project |
| `GET/POST` | `/api/conversations` | List / create conversations |
| `GET/DELETE` | `/api/conversations/:id` | Get / delete a conversation |
| `GET` | `/api/conversations/:id/messages` | List messages in a conversation |

## License

Private - All rights reserved.
