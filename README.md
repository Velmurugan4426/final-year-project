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

Start the API in that same PowerShell window:

```powershell
Set-Location backend
.\mvnw.cmd spring-boot:run
```

The backend uses PostgreSQL. Configure the database and credentials required by
`backend/src/main/resources/application.properties` before starting the API.
