# AI Learning Assistant

The application is split by runtime and tooling:

- `frontend/` contains the React and Vite web app. Use npm from this directory.
- `backend/` contains the Spring Boot API. Use the Maven wrapper from this directory.

## Run the frontend

```powershell
Set-Location frontend
npm install
npm run dev
```

Other frontend commands are `npm run build`, `npm run lint`, and `npm run preview`.
In development, Vite proxies `/api` requests to `http://localhost:8080`.
For a separately hosted frontend, set `VITE_API_URL` to the backend URL.

## Run the backend

Configure the backend environment in the same PowerShell window before starting
Spring Boot. Do not put API keys or passwords into source files:

```powershell
$env:DB_USERNAME = "postgres"
$env:DB_PASSWORD = "<your PostgreSQL password>"
$env:GEMINI_API_KEY = "<your Gemini API key>"
$env:GROK_API_KEY = "<your xAI Grok API key>"
$env:GROQ_API_KEY = "<your Groq API key, for the AI tutor>"
$env:AI_PROVIDER = "gemini"
$env:JWT_SECRET = "<a random secret of at least 32 characters>"
$env:AI_INTERVIEW_ADMIN_EMAIL = "velmurugan808k@gmail.com"
$env:AI_INTERVIEW_UPI_ID = "<your Google Pay UPI ID>"
$env:AI_INTERVIEW_UPI_PAYEE_NAME = "<name shown to the payer>"
```

The database `ai_learning_assistant` must exist in PostgreSQL. Set `DB_PASSWORD`
to the password configured for your local PostgreSQL `postgres` user; the
development startup script does not contain or override database credentials.
Tutor
conversations, messages, and quiz attempts are created automatically through
JPA schema updates. AI keys are used only by the backend. Quiz generation tries
Gemini first and then Grok; if neither provider returns a valid question set,
the quiz uses a clearly identified question-bank fallback. Configure
`GEMINI_API_KEY` and `GROK_API_KEY` (or `XAI_API_KEY`) for generated quizzes.
The AI tutor continues to use `AI_PROVIDER` (`gemini` by default) and Groq
fallback when `GROQ_API_KEY` is configured. You can override `GEMINI_MODEL`,
`GROK_MODEL`, `GROQ_MODEL`, and `VITE_API_URL` for a non-local API host.

AI Interview uses the configured AI provider for resume-aware questions and
end-of-session coaching. Set `AI_INTERVIEW_ADMIN_EMAIL` to the administrator
account email; only that authenticated account can issue time-limited free
grants, search accounts by name/email, revoke admin grants without removing
paid access, review monitoring signals, or verify subscription payments.
Resume uploads over 5 MB are rejected before submission in the UI and return a
clear payload-too-large response from the API. Configure
`AI_INTERVIEW_UPI_ID` on the backend before enabling subscriptions; do not put
the UPI ID into frontend source. The app generates a local UPI QR and payment
link for a fixed ₹1 payment. Users submit the transaction reference, and an
administrator must verify the ₹1 credit against their own Google Pay/bank
history and approve it before one day of access is granted. Submitting a UTR
or a screenshot alone never grants access. Pending payments can be approved or
rejected from the AI Interview administration panel.

Resumes (PDF, max 5 MB), original file bytes, and extracted text are stored in
PostgreSQL and can be removed by the account owner. Completed interview
feedback provides a topic-by-topic knowledge review with a rating, evidence
from the candidate's own answers, and actionable next steps. It only assesses
topics covered by the transcript. Camera/microphone access is requested only
after the user starts setup. The local camera preview is not recorded or
uploaded. Monitoring signals (tab hidden, full-screen exit, or device
interruption) are stored in the administrator review panel; they are not proof
of misconduct. Interview coaching is not a validated hiring assessment and
has no guaranteed accuracy percentage.
AI Interview reads questions aloud and accepts voice answers only; typed answers
are disabled. Use a current Chrome or Edge browser with speech synthesis and
`MediaRecorder` enabled. The interviewer automatically selects a likely
female-sounding installed voice when available; voice names and availability
depend on the browser and operating system, and another installed voice can be
selected in the interview.

Answer audio is buffered temporarily in the browser and sent for transcription
only after the candidate stops recording. Set `GROQ_API_KEY` to enable the
Groq Whisper transcription service (`GROQ_TRANSCRIPTION_MODEL` defaults to
`whisper-large-v3-turbo`). Choose the answer language before recording. If the
service is unavailable, browser speech recognition is used as a fallback and
the UI identifies that fallback. The candidate can review the transcript
before submission. Audio is not persisted by this application, but audio sent
to Groq or handled by browser speech recognition is subject to those providers'
privacy policies. This is turn-based interaction, not a streaming
conversational audio model. During an interview, on-device TensorFlow.js models check for the
candidate's face and can warn about phone-like objects. A face missing across
consecutive camera checks ends the interview; brief detection errors or false
alarms are possible, so this is not proof of misconduct. Camera frames are
processed in the browser and are not uploaded; model weights are downloaded by
the browser. Admins can search users, grant access for 1-365 days, and revoke
admin grants without revoking paid access.

Start the API in that same PowerShell window:

```powershell
Set-Location backend
.\mvnw.cmd spring-boot:run
```

The backend uses PostgreSQL. Configure the database and credentials required by
`backend/src/main/resources/application.properties` before starting the API.
