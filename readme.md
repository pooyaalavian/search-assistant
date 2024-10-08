

# Server
- Setup venv
```
python3.12 -m venv .venv
```
- To start the server for dev:
    - on windows: `python -m uvicorn dev:app --port 5000 --reload`
    - on linux: `python -m quart run --port=5000 --host=127.0.0.1 --reload`
    - or use vs code debugger (will import .env file too!)