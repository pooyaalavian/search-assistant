from dotenv import load_dotenv

load_dotenv()

from app import create_app
from uvicorn import run
import os

app = create_app()

run(app, port=5000)