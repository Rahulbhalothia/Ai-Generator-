"""
app.py — Flask proxy between the frontend and fal.ai.
The browser never sees FAL_KEY; only this server does.

Endpoints:
  POST /api/generate?action=submit   { prompt, duration, aspect_ratio }
  GET  /api/generate?action=status&request_id=...
  GET  /api/generate?action=result&request_id=...
  GET  /healthz                       simple health check for Render

Run locally:
  pip install -r requirements.txt
  python app.py
  -> serves on http://localhost:5000

Deploy on Render:
  Build command: pip install -r requirements.txt
  Start command: gunicorn app:app
  Env vars: FAL_KEY (required), FAL_MODEL (optional), ALLOWED_ORIGIN (recommended)
"""

import os
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()  # reads .env into environment variables (local dev only)

FAL_KEY = os.environ.get("FAL_KEY")
FAL_MODEL = os.environ.get("FAL_MODEL", "fal-ai/kling-video/v1/standard/text-to-video")

# Set this on Render once your frontend has a real domain, e.g.
# ALLOWED_ORIGIN=https://animeall.com
# Leave unset locally to allow any origin during development.
ALLOWED_ORIGIN = os.environ.get("ALLOWED_ORIGIN", "*")

if not FAL_KEY:
    raise RuntimeError("FAL_KEY is not set. Add it in Render → Environment.")

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": ALLOWED_ORIGIN}})

FAL_HEADERS = {
    "Authorization": f"Key {FAL_KEY}",
    "Content-Type": "application/json",
}

ALLOWED_DURATIONS = {"5", "10"}
ALLOWED_RATIOS = {"16:9", "9:16", "1:1"}


@app.route("/healthz", methods=["GET"])
def healthz():
    # Render (and uptime monitors) can hit this to confirm the service is alive.
    return jsonify({"status": "ok"}), 200


@app.route("/api/generate", methods=["POST", "GET", "OPTIONS"])
def generate():
    if request.method == "OPTIONS":
        return "", 204

    action = request.args.get("action", "")

    if action == "submit":
        return _submit()
    elif action == "status":
        return _status()
    elif action == "result":
        return _result()
    else:
        return jsonify({"error": "Unknown action. Use submit, status, or result."}), 400


def _submit():
    data = request.get_json(silent=True) or {}
    prompt = (data.get("prompt") or "").strip()
    duration = str(data.get("duration", "5"))
    ratio = data.get("aspect_ratio", "16:9")

    if not prompt:
        return jsonify({"error": "Prompt is required."}), 400

    # Guardrails so a stray request can't rack up huge bills
    if duration not in ALLOWED_DURATIONS:
        duration = "5"
    if ratio not in ALLOWED_RATIOS:
        ratio = "16:9"

    url = f"https://queue.fal.run/{FAL_MODEL}"
    try:
        resp = requests.post(
            url,
            headers=FAL_HEADERS,
            json={"prompt": prompt, "duration": duration, "aspect_ratio": ratio},
            timeout=60,
        )
    except requests.RequestException as e:
        return jsonify({"error": f"Upstream request failed: {e}"}), 502

    return (resp.text, resp.status_code, {"Content-Type": "application/json"})


def _status():
    request_id = request.args.get("request_id", "")
    if not request_id:
        return jsonify({"error": "request_id is required."}), 400

    url = f"https://queue.fal.run/{FAL_MODEL}/requests/{request_id}/status"
    try:
        resp = requests.get(url, headers=FAL_HEADERS, timeout=30)
    except requests.RequestException as e:
        return jsonify({"error": f"Upstream request failed: {e}"}), 502

    return (resp.text, resp.status_code, {"Content-Type": "application/json"})


def _result():
    request_id = request.args.get("request_id", "")
    if not request_id:
        return jsonify({"error": "request_id is required."}), 400

    url = f"https://queue.fal.run/{FAL_MODEL}/requests/{request_id}"
    try:
        resp = requests.get(url, headers=FAL_HEADERS, timeout=30)
    except requests.RequestException as e:
        return jsonify({"error": f"Upstream request failed: {e}"}), 502

    return (resp.text, resp.status_code, {"Content-Type": "application/json"})


if __name__ == "__main__":
    # Render injects the port to bind to via $PORT.
    # Falls back to 5000 for local development.
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "false").lower() == "true"
    app.run(host="0.0.0.0", port=port, debug=debug)
