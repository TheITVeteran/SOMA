# SOMA Orb — Platform Audit & Roadmap

## Current State (assessed 2026-03-25)

The core voice loop (hear → think → speak) is production-grade. The main Orb tab in SomaCommandBridge is well-wired to `useSomaAudio` which handles Whisper STT, ElevenLabs TTS, VAD, interruption detection, and real SOMA reasoning. The gap is the floating OrbWidget (dead API routes), Whisper's external dependency being invisible to users, and conversations vanishing on page refresh.

**Estimated reality ratio: ~70% real / 30% dead or placeholder**

---

## Component Reality Matrix

| Component | Data Source | Status | Notes |
|-----------|-------------|--------|-------|
| `Orb.jsx` | CSS/state | REAL | 4-layer animated sphere, volume-driven scaling |
| `useSomaAudio.js` | Whisper :5002 → `/api/soma/chat` → ElevenLabs | REAL | Complete STT/TTS pipeline, VAD, interruption detection |
| Main Orb tab (SomaCommandBridge) | useSomaAudio hook | REAL | Full UI — conversation log, volume meters, status badges |
| `elevenLabsTTS.js` | ElevenLabs REST API | REAL | Needs `VITE_ELEVENLABS_API_KEY` env var |
| `somaClient.js` | `/api/soma/chat` | REAL | Brain reasoning + cognitive stream WebSocket |
| `OrbWidget.jsx` (floating panel) | `/api/reason`, `/api/code/task` | **BROKEN** | Dead endpoints — nothing returned for non-greetings |
| `OrbVoiceService.js` | Web Speech API | STALE | Superseded by useSomaAudio, still used by OrbWidget |
| `/api/fs/read` | — | **MISSING** | OrbWidget @filename context injection calls this, doesn't exist |
| `/api/audio/transcribe` (backend) | AudioProcessingArbiter | **FAKE** | Calls non-existent arbiter; real transcription is client-side |
| `VoiceInput.jsx` | `/api/audio/transcribe` | ORPHANED | Not imported anywhere |
| `FloatingOrbWidget.jsx` | — | UNUSED | Not integrated into any tab |
| `audioUtils.ts` | — | UNUSED | PCM helpers never imported |

---

## The Big External Dependency

**Whisper runs at `http://localhost:5002` — it is NOT bundled with SOMA.**

`useSomaAudio` checks `GET http://localhost:5002/health` on connect. If down, it silently falls back to the browser's `SpeechRecognition` API with no visible explanation to the user.

**Browser STT vs Whisper:**
| Feature | Browser STT | Whisper |
|---------|-------------|---------|
| Chrome/Edge | ✓ | ✓ |
| Firefox | ✗ (not supported) | ✓ |
| Custom vocabulary | ✗ | ✓ |
| Technical terms | Degrades | Strong |
| Privacy (offline) | ✗ (sent to Google) | ✓ |
| Hallucination filtering | Not needed | 52-word blocklist |

**To run Whisper server:**
```bash
pip install faster-whisper uvicorn fastapi
# Then run a whisper_server.py that serves POST /transcribe and GET /health on :5002
```

No setup script or docs existed before this audit.

---

## Gap vs Production Voice Assistants

| What Alexa / GPT Voice have | What SOMA Orb has | Gap |
|-----------------------------|-------------------|-----|
| Bundled/managed STT | External Whisper at :5002 (user must run) | **Large** |
| Conversation persistence across sessions | In-memory only, lost on refresh | **Medium** |
| Wake word detection | Manual "Establish Neural Link" click | **Medium** |
| Streaming TTS (word-by-word) | Sentence-chunked TTS | Small |
| Voice selection UI | Hardcoded env var | Small |
| Interruption + graceful cutoff | Implemented ✓ | Done |
| Multi-turn context with memory | conversationId + MnemonicArbiter recall ✓ | Done |
| Thinking/reasoning visualization | SomaCognitiveStream + reasoning tree overlay ✓ | Done |
| Natural pacing (sentence pauses) | Implemented ✓ | Done |

---

## The Big 3 (do these first)

### 1. Fix OrbWidget's dead routes
**Estimated effort:** ~1 hour
**Status:** COMPLETED ✓

OrbWidget's "smart routing" called `/api/reason` and `/api/code/task` — neither route exists. All non-greeting queries failed silently. Also added `/api/fs/read` backend route for @filename context injection.

**What was done:**
- Replaced `handleReasoning` + `handleCodeTask` + `handleSimpleChat` with a unified `callSoma()` that routes to `/api/soma/chat`
- Added `POST /api/fs/read` route to routes.js (path-checked against allowedRoots)
- SOMA's backend fast-path detection handles greetings instantly without extra latency

---

### 2. Whisper status transparency
**Estimated effort:** ~1 hour
**Status:** COMPLETED ✓

Users had no idea when Whisper was offline and they were using Chrome's browser STT instead. Added an amber banner in the Orb tab that appears when `orbSystemStatus.whisperServer === 'fallback'` or `'error'`, explaining the situation and what to do.

---

### 3. Conversation persistence
**Estimated effort:** ~1.5 hours
**Status:** COMPLETED ✓

Conversations were lost on page refresh. `system.conversationHistory` already has `addMessage` and `getRecentMessages`. Added `GET /api/orb/history` route and load-on-connect in SomaCommandBridge so the session log repopulates from SOMA's memory.

---

## Next Tier — After Big 3

### Tier 2 — Medium effort, high visibility

**A. Bundle a Whisper server setup script**
- Add `whisper_server.py` to SOMA root using `faster-whisper` library (CPU-friendly, ~500MB)
- Or: Expose `/api/audio/transcribe` on the backend that calls localhost:5002 server-side
- Add `start_whisper.bat` launcher alongside `start_production.bat`
- Remove the hard dependency on the user knowing to run a separate Python server

**B. ElevenLabs voice selector UI**
- Add a small voice selector to the Orb tab bottom bar (dropdown or voice preview cards)
- Fetch available voices from `/api/soma/elevenlabs/voices` (proxy to ElevenLabs voices list)
- Persist selected voiceId in localStorage
- Currently `VITE_ELEVENLABS_VOICE_ID` is a build-time env var — make it runtime

**C. Wake word detection (browser-side)**
- Run a lightweight always-on SpeechRecognition loop listening only for "Hey SOMA"
- On match: auto-connect the orb + animate a "Neural Link Engaging..." state
- Disconnect after 30s of silence post-response
- Keeps mic usage minimal between interactions

**D. OrbWidget Text Input**
- The floating OrbWidget has no text input field — voice only
- Add a small text bar at the bottom of the expanded view
- Matches the main Orb tab's manual command input

### Tier 3 — Larger features

**E. Streaming TTS word-by-word**
- ElevenLabs supports streaming (`/text-to-speech/{id}/stream`)
- Currently buffers the full sentence before playing
- Streaming would start audio 200-300ms faster (feels much more real-time)
- Need to pipe streaming response through AudioContext incrementally

**F. Conversation branching**
- "Go back to what you said earlier about X" — branch to a past message
- Requires storing a tree not a linear array
- High UX value for research/exploration conversations

**G. Push-to-talk mode**
- Hold spacebar = recording, release = sends
- Complements the existing auto-VAD mode
- Useful in noisy environments where VAD triggers false-positives

**H. Voice emotion detection**
- Detect user's emotional state from audio (tone, pace, pitch)
- Feed into SOMA's UserFingerprintArbiter
- SOMA adapts formality/warmth based on detected emotional state

---

## Known Bugs / Issues

1. ~~**OrbWidget dead routes**~~ — **FIXED** (Big #1: all routes → `/api/soma/chat`)
2. ~~**No /api/fs/read route**~~ — **FIXED** (Big #1: added to routes.js)
3. ~~**Silent Whisper fallback**~~ — **FIXED** (Big #2: amber banner explains current STT mode)
4. ~~**Conversation lost on refresh**~~ — **FIXED** (Big #3: /api/orb/history + load on connect)
5. **ElevenLabs key is build-time** — needs `VITE_ELEVENLABS_API_KEY` set before `npm run build`
6. **OrbWidget uses OrbVoiceService** — stale Web Speech only, no Whisper/ElevenLabs
7. **VoiceInput.jsx orphaned** — never imported, earlier iteration
8. **FloatingOrbWidget.jsx unused** — not integrated into any tab
9. **No Whisper setup script** — users must know to run a Python Whisper server separately
10. **ws/cognitive endpoint** — SomaCognitiveStream connects here but route isn't verified as registered

---

## Realistic Comparison

| Platform | Voice Quality | STT | TTS | Persistence | Intelligence |
|----------|--------------|-----|-----|-------------|--------------|
| **Alexa** | High | Bundled/custom | Amazon Polly | Cloud | Limited |
| **GPT Voice** | High | Whisper (OpenAI) | OpenAI TTS | Cloud | GPT-4o |
| **Siri** | High | Apple on-device | Neural | iCloud | Limited |
| **SOMA Orb** | High (when ElevenLabs) | Whisper/browser fallback | ElevenLabs/browser | **Session only (fixed)** | Full QuadBrain |

**SOMA's advantage:** The reasoning layer — QuadBrain (LOGOS/AURORA/THALAMUS/PROMETHEUS), MnemonicArbiter memory recall, real context window, tool access, full personality engine. No other voice assistant has this depth. The gap is infrastructure (bundled STT), not intelligence.
