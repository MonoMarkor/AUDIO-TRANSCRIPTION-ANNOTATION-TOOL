# Audio Transcription Annotation Tool

A tool for correcting AI-generated speech transcripts and tagging them with
structured annotations (medical terms, measurements, numbers, formatting
commands, spelled-out words, named entities), built for a single annotator
working on one machine.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Docker Compose)
- Node.js 22+ is used inside the containers — you do **not** need Node installed
  on your host machine to run the app, only Docker.

## Install & Run

1. Clone the repository:
   ```bash
   git clone https://github.com/MonoMarkor/AUDIO-TRANSCRIPTION-ANNOTATION-TOOL.git
   cd AUDIO-TRANSCRIPTION-ANNOTATION-TOOL
   ```

2. Start everything with Docker Compose:
   ```bash
   docker compose up
   ```
   This starts Postgres, MinIO, the backend API, and the frontend dev server.
   The first run will take a minute or two while dependencies install inside
   the containers and database migrations run.

3. Open the app in your browser:
   ```
   http://localhost:5173
   ```

   The backend API runs at `http://localhost:3000`, and the MinIO console
   (for inspecting stored audio files) is available at `http://localhost:9001`.

## Using the tool

- On the dashboard, upload one or more audio files (`.wav`, `.mp3`, `.m4a`)
  and a transcript JSON file (or paste a single transcript directly). Items
  are automatically paired by filename; unpaired items can be paired
  manually further down the page.
- Click any row in the work queue to open the annotator workspace, where you
  can play the audio, correct the transcript, and tag spans of text.
- Use the **Export JSONL** button on the dashboard to download the gold
  standard dataset.

## Stopping

```bash
docker compose down
```

Add `-v` to also remove the database/MinIO data volumes if you want a fully
clean slate on the next run.

## Design notes

See [DESIGN.md](./DESIGN.md) for the data model, key decisions, and known
trade-offs/cuts.