"""
app.py — Flask proxy between the frontend and fal.ai.
The browser never sees FAL_KEY; only this server does.

Endpoints:
  POST /api/generate?action=submit   { prompt, duration, aspect_ratio }
  GET  /api/generate?action=status&request_id=...
  GET  /api/generate?action=result&request_id=...

Run locally:
  pip install -r requirements.txt
  python app.py
  -> serves on http://localhost:5000
"""

import os
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()  # reads .env into environment variables

FAL_KEY = os.environ.get("FAL_KEY")
FAL_MODEL = os.environ.get("FAL_MODEL", "fal-ai/kling-video/v1/standard/text-to-video")

if not FAL_KEY:
    raise RuntimeError("FAL_KEY is not set. Add it to your .env file.")

app = Flask(__name__)

# For local dev this allows any origin. Once AnimeAll is live, replace
# origins="*" with your real domain, e.g. origins="https://animeall.com",
# so no other site can ride on your fal.ai credits.
CORS(app, resources={r"/api/*": {"origins": "*"}})

FAL_HEADERS = {
    "Authorization": f"Key {FAL_KEY}",
    "Content-Type": "application/json",
}

ALLOWED_DURATIONS = {"5", "10"}
ALLOWED_RATIOS = {"16:9", "9:16", "1:1"}


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
    app.run(host="0.0.0.0", port=5000, debug=True)
