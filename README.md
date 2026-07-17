# GuardianAI - Disaster & Emergency Response Assistant

GuardianAI is a production-ready, full-stack Multi-Agent application designed to coordinate safety resources, first-aid tips, weather predictions, and emergency communications during critical weather alerts and natural disasters. 

The system leverages Google's **Agent Development Kit (ADK)** concepts to deploy a centralized Coordinator Agent that delegates logistics goals to specialized sub-agents. It integrates an independent custom **Model Context Protocol (MCP)** server via stdio JSON-RPC.

---

## 🗺️ Architecture Overview

```
                        +-------------------------------------+
                        |          React Vite Client          |
                        |      (Dashboard, Map, Timeline)     |
                        +-------------------------------------+
                                           |
                                  REST APIs & JWT Auth
                                           v
                        +-------------------------------------+
                        |           FastAPI Backend           |
                        |     (JWT Guards & Injection Scan)   |
                        +-------------------------------------+
                                           |
                                           v
                        +-------------------------------------+
                        |      Coordinator Agent (ADK)        |
                        +-------------------------------------+
                                 /    |     |     \     \
                               /      |     |       \     \
                             v        v     v         v     v
                  +---------+ +---------+ +---------+ +---------+ +---------+
                  | Weather | | Medical | | Shelter | |Resource | | Comm    |
                  |  Agent  | |  Agent  | |  Agent  | |  Agent  | | Agent   |
                  +---------+ +---------+ +---------+ +---------+ +---------+
                       \           |           |           /           /
                        \          |           |          /           /
                         v         v           v         v           v
                        +-------------------------------------+
                        |             MCP Client              |
                        +-------------------------------------+
                                           |
                                     stdio JSON-RPC
                                           v
                        +-------------------------------------+
                        |             MCP Server              |
                        |      (Weather, Maps, Hospitals)     |
                        +-------------------------------------+
```

### 1. Specialized Agent Network (ADK)
- **Coordinator Agent**: The brain of the operation. Analyzes user queries to route them to the relevant specialized agents, triggers execution in parallel, and merges their outputs into an actionable consolidated Emergency Response Plan.
- **Weather Agent**: Assesses storm warning forecasts, rainfall ratios, and alert severity indices using MCP tools.
- **Medical Agent**: Recommends first-aid procedures and lists nearby hospital locations with active wait times and ICU capacities.
- **Shelter Agent**: Discovers local safe havens, community cots, distance coordinates, and pet policies.
- **Resource Agent**: Suggests critical supply lists (water rations, non-perishable food kits, battery backups) depending on the threat type.
- **Communication Agent**: Crafts broadcast alerts (SMS, radio drafts) and translates them into Spanish, French, or Mandarin.

### 2. Custom MCP Tools
Our JSON-RPC stdio MCP server exposes:
- `get_weather(location)`: Live meteorological alerts and wind gust forecasts.
- `search_places(location, query)`: Shelter database coordinates.
- `lookup_hospitals(location)`: Patient wait times and ICU room directories.
- `get_disaster_alerts(location)`: Local weather warnings.
- `get_emergency_helplines(region)`: Phone directories.

### 3. Production Security Features
- **Prompt Injection Protection**: A scanning layer scans all queries against regex patterns of instruction overrides, DAN prompts, or jailbreaks, rejecting attacks with a `400 Bad Request`.
- **JWT Authentication & RBAC**: Session isolation and roles. Only authenticated users can converse, and only users with the `RESPONDER` role can issue new warnings.
- **Strict Input Validation**: Fields checked using Pydantic models.
- **API Key Fallback**: If the `GEMINI_API_KEY` is missing or invalid, the agents automatically activate a high-fidelity simulation engine to generate realistic briefings.

---

## 🚀 Quick Start Guide

### 1. Environmental Setup
Copy the `.env.example` in the project root to `.env`:
```bash
cp .env.example .env
```
Open `.env` and fill in your Google Gemini API key:
`GEMINI_API_KEY=AIzaSy...` *(Leave empty to run in simulation/fallback mode)*

### 2. Run Locally (Development)

#### Backend & MCP Server
Ensure you have Python 3.10+ installed:
```bash
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```
- API will run at `http://localhost:8000`.
- Swagger interactive documentation available at `http://localhost:8000/docs`.

#### Frontend Client
```bash
cd frontend
npm install
npm run dev
```
- Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🐳 Docker Deployment

To launch the backend, frontend, and stdio MCP server in unified, cloud-ready Docker containers, run:
```bash
docker-compose up --build
```
- **Frontend App**: `http://localhost:5173`
- **FastAPI Backend**: `http://localhost:8000`

---

## 🧪 Running Automated Tests

To execute our pytest coverage suite (covering security filters, JWT tokens, ADK routing, and MCP stdio JSON-RPC fallbacks):
```bash
cd backend
python -m pytest --assert=plain --cache-clear tests/
```

---

## 📝 Credentials for Testing
You can register new profiles on the authentication screen, or use the pre-filled shortcuts:
- **Citizen (User)**: Username `citizen_jane`, Password `password123` (Accesses chats, map, and checklists).
- **First Responder (Responder)**: Username `chief_john`, Password `password123` (Accesses chats, maps, checklists, and publishes warning alerts).
