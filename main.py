import os
from fastapi import FastAPI  # pyrefly: ignore
from fastapi.middleware.cors import CORSMiddleware  # pyrefly: ignore

app = FastAPI(
    title="AquaRescue Backend API",
    description="AquaRescue Backend Services",
    version="1.0.0",
)

# CORS Configuration
frontend_url = os.getenv("FRONTEND_URL", "https://aquarescue.vercel.app?_vercel_share=RoqFIijyGE9ZvMiAb1rJVy2k76nnLJXX")
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    frontend_url,
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"status": "AquaRescue Backend Operational"}
