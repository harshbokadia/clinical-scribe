import os
import json
import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Dict, List, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from livekit import api as livekit_api
from note_generator import generate_note
from document_export import export_pdf, export_docx
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

room_transcripts: Dict[str, List[str]] = {}
room_notes: Dict[str, dict] = {}
room_connections: Dict[str, List[WebSocket]] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(title="Clinical Scribe API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class TokenRequest(BaseModel):
    room_name: str
    participant_name: str


class TranscriptChunk(BaseModel):
    room: str
    text: str


class RoomRequest(BaseModel):
    room: str


@app.post("/token")
async def get_token(req: TokenRequest):
    token = (
        livekit_api.AccessToken(
            os.environ["LIVEKIT_API_KEY"],
            os.environ["LIVEKIT_API_SECRET"],
        )
        .with_identity(req.participant_name)
        .with_grants(
            livekit_api.VideoGrants(
                room_join=True,
                room=req.room_name,
            )
        )
        .to_jwt()
    )
    return {"token": token, "url": os.environ["LIVEKIT_URL"]}


@app.post("/internal/transcript")
async def receive_transcript(chunk: TranscriptChunk):
    if chunk.room not in room_transcripts:
        room_transcripts[chunk.room] = []
    room_transcripts[chunk.room].append(chunk.text)

    connections = room_connections.get(chunk.room, [])
    dead: List[WebSocket] = []
    for ws in connections:
        try:
            await ws.send_json({"type": "transcript", "text": chunk.text})
        except Exception:
            dead.append(ws)
    for ws in dead:
        connections.remove(ws)

    return {"status": "ok"}


@app.websocket("/ws/{room_name}")
async def websocket_endpoint(websocket: WebSocket, room_name: str):
    await websocket.accept()
    if room_name not in room_connections:
        room_connections[room_name] = []
    room_connections[room_name].append(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        if room_name in room_connections:
            try:
                room_connections[room_name].remove(websocket)
            except ValueError:
                pass


@app.post("/generate-note")
async def generate_doctor_note(req: RoomRequest):
    transcript = room_transcripts.get(req.room, [])
    if not transcript:
        raise HTTPException(status_code=400, detail="No transcript found for this room.")
    full_text = " ".join(transcript)
    note = await generate_note(full_text)
    room_notes[req.room] = note
    return {"note": note}


@app.post("/export/pdf")
async def export_note_pdf(req: RoomRequest):
    note = await _get_or_generate_note(req.room)
    path = export_pdf(note)
    return FileResponse(path, filename="clinical_note.pdf", media_type="application/pdf")


@app.post("/export/docx")
async def export_note_docx(req: RoomRequest):
    note = await _get_or_generate_note(req.room)
    path = export_docx(note)
    return FileResponse(
        path,
        filename="clinical_note.docx",
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )


async def _get_or_generate_note(room: str) -> dict:
    if room in room_notes:
        return room_notes[room]
    transcript = room_transcripts.get(room, [])
    if not transcript:
        raise HTTPException(status_code=400, detail="No transcript found for this room.")
    full_text = " ".join(transcript)
    note = await generate_note(full_text)
    room_notes[room] = note
    return note
