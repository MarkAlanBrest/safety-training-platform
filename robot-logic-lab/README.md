# Robot Logic Lab

A standalone web app for beginners learning pseudocode and logic through FTC-inspired robot problems. Eight selectable units include short lessons, explained examples, knowledge checks, editable practice, hints, and AI feedback. Progress and drafts are saved in the current browser. No installation or database is required.

## Run locally

Requires Node.js 22 or later. In this directory:

```powershell
npm start
```

Open http://localhost:3100. The server binds to localhost. This project is independent of the parent safety-training application and can be moved to its own folder.

## Connect the AI coach

Copy `.env.example` to `.env`, set `OPENAI_API_KEY`, and restart. Optionally change `OPENAI_MODEL` to a model your account can access that supports Responses API structured outputs. The default is `gpt-4o-mini`. The key stays on the server. Student answers are sent to OpenAI only when students request a review; API requests use `store: false`. Normal API provider data policies still apply.

The app uses the [OpenAI Responses structured output format](https://developers.openai.com/api/docs/guides/structured-outputs) for criterion-based feedback. Without a key, practice returns an explicitly labeled self-review checklist and never claims to grade or pass an answer. Unit completion requires a correct knowledge check and passing AI feedback. Editing an answer clears its previous assessment. AI feedback can be mistaken; instructor review remains useful.

## Curriculum

1. Pseudocode and sequencing
2. Variables and arithmetic
3. Decisions and boundary values
4. Boolean logic
5. Loops, sensors, and termination
6. Functions and parameters
7. Debugging and test cases
8. Autonomous planning capstone

Robot commands are conceptual pseudocode, not executable SDK methods. Examples are season-independent and the app is not affiliated with FIRST. It does not control hardware.

## Verify

```powershell
npm test
```

Tests cover validation, offline behavior, AI request structure, malformed/refused responses, origin checks, and private-file isolation, using a mocked provider (no billable requests).

## Scope

This is a working local first version. It has no student accounts, teacher dashboard, cloud progress synchronization, or public hosting. Before public classroom deployment, add authentication, persistent account-level usage limits, and an appropriate school privacy workflow. The current server limits AI reviews to 10 per minute per IP in memory. Clearing browser storage clears progress. `PORT` defaults to 3100.
