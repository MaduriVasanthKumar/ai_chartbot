import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.db.database import init_db
from app.api.endpoints import router
from app.services.ai_service import GeminiServiceError

app = FastAPI(
    title="EduMate AI - Advanced Learning Assistant API",
    description="Backend API supporting persistent chat, memory layers, quiz generation, document Q&A, and learning analytics.",
    version="1.0.0"
)


@app.exception_handler(GeminiServiceError)
async def gemini_service_error_handler(request: Request, error: GeminiServiceError):
    """Expose a safe provider error without logging or returning raw SDK details."""
    return JSONResponse(
        status_code=error.status_code,
        content={"detail": str(error)},
    )


# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows requests from Vite frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_event():
    print("[EduMate AI] Initializing database tables...")
    init_db()
    print("[EduMate AI] Database ready!")

app.include_router(router)

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
