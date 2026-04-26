import { useState, useEffect, useRef, useCallback } from "react";
import { LiveKitRoom, useLocalParticipant, RoomAudioRenderer } from "@livekit/components-react";

const API = "http://localhost:8000";
const ROOM_NAME = "consultation-room";

function generateParticipantName() {
  return `Doctor-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

export default function App() {
  const [token, setToken] = useState(null);
  const [liveKitUrl, setLiveKitUrl] = useState(null);
  const [participantName] = useState(generateParticipantName);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);

  async function startConsultation() {
    setConnecting(true);
    setError(null);
    try {
      const res = await fetch(`${API}/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room_name: ROOM_NAME, participant_name: participantName }),
      });
      if (!res.ok) throw new Error("Failed to get token.");
      const data = await res.json();
      setLiveKitUrl(data.url);
      setToken(data.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setConnecting(false);
    }
  }

  if (!token) {
    return (
      <div className="landing">
        <div className="landing-card">
          <div className="logo-mark">✦</div>
          <h1 className="landing-title">Clinical Scribe</h1>
          <p className="landing-subtitle">
            AI-powered consultation documentation. Speak naturally — the note writes itself.
          </p>
          {error && <p className="error-msg">{error}</p>}
          <button className="btn-primary" onClick={startConsultation} disabled={connecting}>
            {connecting ? "Connecting…" : "Begin Consultation"}
          </button>
          <p className="landing-note">Ensure your microphone is enabled before starting.</p>
        </div>
      </div>
    );
  }

  return (
    <LiveKitRoom
      serverUrl={liveKitUrl}
      token={token}
      connect={true}
      audio={true}
      video={false}
      onDisconnected={() => { setToken(null); setLiveKitUrl(null); }}
    >
      <RoomAudioRenderer />
      <ScribeInterface participantName={participantName} />
    </LiveKitRoom>
  );
}

function ScribeInterface({ participantName }) {
  const { localParticipant } = useLocalParticipant();
  const [transcript, setTranscript] = useState([]);
  const [note, setNote] = useState(null);
  const [phase, setPhase] = useState("recording");
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(null);
  const transcriptRef = useRef(null);
  const wsRef = useRef(null);
  const elapsedRef = useRef(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:8000/ws/${ROOM_NAME}`);
    wsRef.current = ws;
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "transcript") {
        setTranscript((prev) => [...prev, msg.text]);
      }
    };
    return () => ws.close();
  }, []);

  useEffect(() => {
    if (phase !== "recording") return;
    const interval = setInterval(() => {
      elapsedRef.current += 1;
      setElapsed((v) => v + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [transcript]);

  const formatTime = (s) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  async function endConsultation() {
    setPhase("generating");
    setGenerating(true);
    try {
      const res = await fetch(`${API}/generate-note`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room: ROOM_NAME }),
      });
      if (!res.ok) throw new Error("Note generation failed.");
      const data = await res.json();
      setNote(data.note);
      setPhase("done");
    } catch (err) {
      setPhase("recording");
      alert(err.message);
    } finally {
      setGenerating(false);
    }
  }

  async function downloadFile(format) {
    setExporting(format);
    try {
      const res = await fetch(`${API}/export/${format}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room: ROOM_NAME }),
      });
      if (!res.ok) throw new Error("Export failed.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `clinical_note.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message);
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="scribe">
      <header className="header">
        <div className="header-left">
          <span className="logo-small">✦</span>
          <span className="header-title">Clinical Scribe</span>
          <span className="divider">|</span>
          <span className="header-room">{ROOM_NAME}</span>
        </div>
        <div className="header-center">
          {phase === "recording" && (
            <div className="recording-badge">
              <span className="recording-dot" />
              RECORDING — {formatTime(elapsed)}
            </div>
          )}
          {phase === "generating" && (
            <div className="generating-badge">
              <span className="spinner" /> GENERATING NOTE…
            </div>
          )}
          {phase === "done" && (
            <div className="done-badge">✓ NOTE READY</div>
          )}
        </div>
        <div className="header-right">
          {phase === "recording" && (
            <button className="btn-end" onClick={endConsultation}>
              End Consultation
            </button>
          )}
          {phase === "done" && (
            <div className="export-buttons">
              <button
                className="btn-export"
                onClick={() => downloadFile("pdf")}
                disabled={exporting !== null}
              >
                {exporting === "pdf" ? "Exporting…" : "↓ PDF"}
              </button>
              <button
                className="btn-export"
                onClick={() => downloadFile("docx")}
                disabled={exporting !== null}
              >
                {exporting === "docx" ? "Exporting…" : "↓ DOCX"}
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="panels">
        <div className="panel panel-left">
          <div className="panel-header">
            <span className="panel-label">LIVE TRANSCRIPT</span>
            <span className="panel-count">{transcript.length} segments</span>
          </div>
          <div className="transcript-body" ref={transcriptRef}>
            {transcript.length === 0 ? (
              <p className="empty-state">
                Listening for speech…<br />
                <span>The transcription will appear here in real time.</span>
              </p>
            ) : (
              transcript.map((line, i) => (
                <p key={i} className="transcript-line">
                  <span className="transcript-index">{String(i + 1).padStart(2, "0")}</span>
                  {line}
                </p>
              ))
            )}
          </div>
        </div>

        <div className="panel panel-right">
          <div className="panel-header">
            <span className="panel-label">CLINICAL NOTE</span>
          </div>
          <div className="note-body">
            {!note && phase === "recording" && (
              <p className="empty-state">
                The structured note will appear here<br />
                <span>after you end the consultation.</span>
              </p>
            )}
            {!note && phase === "generating" && (
              <div className="generating-state">
                <div className="pulse-ring" />
                <p>Analysing transcript…</p>
              </div>
            )}
            {note && <NoteView note={note} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function NoteView({ note }) {
  return (
    <div className="note-view">
      <NoteSection title="Chief Complaint" icon="◎">
        <p className="note-text">{note.chief_complaint || "Not recorded"}</p>
      </NoteSection>

      <NoteSection title="Symptoms" icon="◈">
        <ul className="note-list">
          {(note.symptoms || []).map((s, i) => <li key={i}>{s}</li>)}
          {(!note.symptoms || note.symptoms.length === 0) && <li className="muted">None recorded</li>}
        </ul>
      </NoteSection>

      <NoteSection title="Clinical Observations" icon="◉">
        <p className="note-text">{note.clinical_observations || "None recorded"}</p>
      </NoteSection>

      <NoteSection title="Diagnosis" icon="◆">
        <p className="note-text diagnosis">{note.diagnosis || "Not stated"}</p>
      </NoteSection>

      <NoteSection title="Medications" icon="⊕">
        {(note.medications || []).length > 0 ? (
          <div className="med-list">
            {note.medications.map((med, i) => (
              <div key={i} className="med-item">
                <span className="med-name">{med.name}</span>
                <div className="med-details">
                  <span>{med.dosage || "—"}</span>
                  <span>{med.frequency || "—"}</span>
                  <span>{med.duration || "—"}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">No medications prescribed</p>
        )}
      </NoteSection>

      <NoteSection title="Precautions" icon="◌">
        <ul className="note-list">
          {(note.precautions || []).map((p, i) => <li key={i}>{p}</li>)}
          {(!note.precautions || note.precautions.length === 0) && <li className="muted">None recorded</li>}
        </ul>
      </NoteSection>

      <NoteSection title="Healthy Practices" icon="◎">
        <ul className="note-list">
          {(note.healthy_practices || []).map((p, i) => <li key={i}>{p}</li>)}
          {(!note.healthy_practices || note.healthy_practices.length === 0) && <li className="muted">None recorded</li>}
        </ul>
      </NoteSection>

      {note.follow_up && note.follow_up !== "null" && (
        <NoteSection title="Follow-Up" icon="→">
          <p className="note-text followup">{note.follow_up}</p>
        </NoteSection>
      )}
    </div>
  );
}

function NoteSection({ title, icon, children }) {
  return (
    <div className="note-section">
      <div className="note-section-header">
        <span className="note-icon">{icon}</span>
        <span className="note-section-title">{title}</span>
      </div>
      <div className="note-section-body">{children}</div>
    </div>
  );
}
