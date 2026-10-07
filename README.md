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
$env:AI_PROVIDER = "gemini"
$env:JWT_SECRET = "<a random secret of at least 32 characters>"
```

The database `ai_learning_assistant` must exist in PostgreSQL. Tutor
conversations and messages are created automatically through JPA schema updates.
Both model keys are used only by the backend. The backend tries the provider
selected by `AI_PROVIDER` first (`gemini` by default), then automatically falls
back to the other configured provider when the first provider is unavailable,
over quota, or returns an error. Set `GROK_API_KEY` (or `XAI_API_KEY`) for Grok
fallback. You can override `GEMINI_MODEL` (defaults to `gemini-3.8-flash`),
`GROK_MODEL` (defaults to `grok-4.7`), and `VITE_API_URL` for a non-local API
host.

Start the API in that same PowerShell window:

```powershell
Set-Location backend
.\mvnw.cmd spring-boot:run
```

The backend uses PostgreSQL. Configure the database and credentials required by
`backend/src/main/resources/application.properties` before starting the API.
