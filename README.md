# Clinical Scribe

An AI-powered clinical documentation agent. A doctor speaks naturally during a consultation — the agent listens silently via LiveKit, transcribes in real time using Deepgram's medical-grade STT model, and generates a structured clinical note the moment the consultation ends. Notes export as both PDF and DOCX.

---

## Architecture

```
Microphone (Doctor)
      ↓
LiveKit Room  ←─────────────────  Observant Agent (agent.py)
                                          ↓
                               Deepgram STT (nova-2-medical)
                                          ↓
                               FastAPI /internal/transcript
                                          ↓
                    WebSocket ──→ React Frontend (live transcript)
                                          ↓
                              [End Consultation clicked]
                                          ↓
                               Groq · LLaMA 3.3 70B
                                          ↓
                    Structured Note (JSON → UI → PDF / DOCX)
```

---

## Project Structure

```
clinical-scribe/
├── backend/
│   ├── main.py             # FastAPI server — token, WebSocket, note generation, export
│   ├── agent.py            # LiveKit observant agent — subscribes, transcribes, forwards
│   ├── note_generator.py   # Groq API — transcript → structured clinical note (JSON)
│   ├── document_export.py  # PDF (ReportLab) and DOCX (python-docx) export
│   ├── requirements.txt
│   └── .env.example        # Copy this to .env and fill in your keys
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx         # LiveKit room, transcript stream, note display
        └── App.css
```

---

## Prerequisites

- Python 3.11+
- Node.js 18+
- A [LiveKit Cloud](https://livekit.io) account (free tier works)
- A [Deepgram](https://deepgram.com) API key (free tier works)
- A [Groq](https://console.groq.com) API key (free tier works)

---

## Step 1 — Configure Environment

Copy `.env.example` to a new file called `.env` inside the `backend/` folder:

```bash
cp backend/.env.example backend/.env
```

Then open `backend/.env` and fill in your credentials:

```env
LIVEKIT_URL=wss://your-project-name.livekit.cloud
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
GROQ_API_KEY=your_groq_api_key
DEEPGRAM_API_KEY=your_deepgram_api_key
BACKEND_URL=http://localhost:8000
```

Where to find each value:

| Key | Where to get it |
|---|---|
| `LIVEKIT_URL` | [cloud.livekit.io](https://cloud.livekit.io) → your project → Settings → Keys |
| `LIVEKIT_API_KEY` | Same page as above |
| `LIVEKIT_API_SECRET` | Same page as above |
| `GROQ_API_KEY` | [console.groq.com](https://console.groq.com) → API Keys |
| `DEEPGRAM_API_KEY` | [console.deepgram.com](https://console.deepgram.com) → API Keys |

---

## Step 2 — Install Backend Dependencies

```bash
cd backend
python -m venv venv

# Mac / Linux
source venv/bin/activate

# Windows (PowerShell)
venv\Scripts\activate

pip install -r requirements.txt
```

---

## Step 3 — Install Frontend Dependencies

```bash
cd frontend
npm install
```

---

## Step 4 — Launch (3 terminals required)

You must run all three processes simultaneously. Open three separate terminal windows or tabs.

**Terminal 1 — FastAPI server**
```bash
cd backend
source venv/bin/activate        # Windows: venv\Scripts\activate
uvicorn main:app --reload --port 8000
```
Wait until you see: `Application startup complete.`

**Terminal 2 — LiveKit agent worker**
```bash
cd backend
source venv/bin/activate        # Windows: venv\Scripts\activate
python agent.py start
```
Wait until you see: `registered worker`

**Terminal 3 — React frontend**
```bash
cd frontend
npm run dev
```
Wait until you see: `Local: http://localhost:5173`

---

## Step 5 — Use the App

1. Open **http://localhost:5173** in your browser
2. Click **Begin Consultation** — allow microphone access when prompted
3. Speak naturally as a doctor would during a consultation
4. Watch the transcript populate on the left panel in real time
5. Click **End Consultation** when done
6. The structured clinical note appears on the right within a few seconds
7. Download as **PDF** or **DOCX**

---

## Clinical Note Structure

| Section | Content |
|---|---|
| Chief Complaint | One-line reason for visit |
| Symptoms | Bulleted list of reported symptoms |
| Clinical Observations | Doctor's physical or diagnostic findings |
| Diagnosis | Primary diagnosis |
| Medications | Name, dosage, frequency, duration |
| Precautions | Things the patient should avoid |
| Healthy Practices | Lifestyle and dietary recommendations |
| Follow-Up | Next appointment or review instructions |

---

## Notes

- The agent is purely **observant** — it never speaks, interrupts, or influences the consultation.
- Dosages are only recorded if explicitly stated by the doctor. Nothing is inferred or invented.
- The generated note should always be reviewed and signed by the treating physician before use.