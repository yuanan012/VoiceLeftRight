"""Zero-dependency local server for microphone and Web Serial access."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import os

ROOT = Path(__file__).resolve().parent
os.chdir(ROOT)
print("Open http://localhost:8000 in desktop Chrome or Edge. Press Ctrl+C to stop.")
ThreadingHTTPServer(("127.0.0.1", 8000), SimpleHTTPRequestHandler).serve_forever()
