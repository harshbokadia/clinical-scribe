# Clinical Scribe

An AI-powered clinical documentation agent. A doctor speaks naturally during a consultation — the agent listens silently via LiveKit, transcribes in real time using Deepgram's medical-grade STT model, and generates a structured clinical note the moment the consultation ends. Notes export as both PDF and DOCX.

## Architecture

```
Microphone (Doctor)
      ↓
LiveKit Room  ←  Observant Agent (agent.py)
                        ↓
               Deepgram STT (nova-2-medical)
                        ↓
               FastAPI /internal/transcript
                        ↓
          WebSocket → React Frontend (live transcript)
                        ↓
              [End Consultation clicked]
                        ↓
               Claude claude-sonnet-4-6
                        ↓
            Structured Note (JSON → UI → PDF/DOCX)
```

## Project Structure

```
clinical-scribe/
├── backend/
│   ├── main.py             # FastAPI server: token, WebSocket, note generation, export
│   ├── agent.py            # LiveKit observant agent: subscribes, transcribes, forwards
│   ├── note_generator.py   # Claude API: transcript → structured clinical note (JSON)
│   ├── document_export.py  # PDF (ReportLab) and DOCX (python-docx) export
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx         # LiveKit room, transcript stream, note display
        └── App.css
```

## Prerequisites

- Python 3.11+
- Node.js 18+
- A [LiveKit Cloud](https://livekit.io) account (free tier works)
- A [Deepgram](https://deepgram.com) API key (free tier works)
- An [Anthropic](https://console.anthropic.com) API key

## Setup

### 1. Backend

```bash
cd backend
cp .env.example .env
# Fill in your keys in .env

python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Frontend

```bash
cd frontend
npm install
```

## Running the App

You need three terminals running simultaneously.

**Terminal 1 — FastAPI server:**
```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload --port 8000
```

**Terminal 2 — LiveKit agent worker:**
```bash
cd backend
source venv/bin/activate
python agent.py start
```

**Terminal 3 — React frontend:**
```bash
cd frontend
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Usage

1. Click **Begin Consultation** — your browser will request microphone access.
2. Speak naturally. The live transcript appears on the left panel in real time.
3. When done, click **End Consultation**. Claude analyses the full transcript and generates the structured note on the right.
4. Review the note, then download as **PDF** or **DOCX**.

## Clinical Note Structure

| Section | Content |
|---|---|
| Chief Complaint | One-line reason for visit |
| Symptoms | Bulleted list of reported symptoms |
| Clinical Observations | Doctor's physical/diagnostic findings |
| Diagnosis | Primary diagnosis |
| Medications | Name, dosage, frequency, duration |
| Precautions | Things the patient should avoid |
| Healthy Practices | Lifestyle and dietary recommendations |
| Follow-Up | Next appointment or review instructions |

## Notes

- The agent is purely **observant** — it never speaks, interrupts, or influences the consultation.
- Dosages are only recorded if explicitly stated by the doctor. Nothing is inferred.
- The generated note should always be reviewed and signed by the treating physician before use.
