import os
from fastapi import FastAPI  # pyrefly: ignore
from fastapi.middleware.cors import CORSMiddleware  # pyrefly: ignore

app = FastAPI(
    title="AquaRescue Backend API",
    description="AquaRescue Backend Services",
    version="1.0.0",
)

# CORS Configuration
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://aquarescue.vercel.app",
    os.getenv("FRONTEND_URL", "https://aquarescue.vercel.app"),
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"status": "AquaRescue Backend Operational"}
