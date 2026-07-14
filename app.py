# ============================================================
# ReelMind AI Backend
# app.py
# Flask Configuration + Security + Health Check + Generation
# ============================================================

import os
import time
import logging
import requests

from dotenv import load_dotenv

from flask import (
    Flask,
    jsonify,
    request
)

from flask_cors import CORS

# ============================================================
# LOAD ENVIRONMENT
# ============================================================

load_dotenv()

# ============================================================
# CONFIG
# ============================================================

FAL_KEY = os.getenv("FAL_KEY")

FAL_MODEL = os.getenv(
    "FAL_MODEL",
    "fal-ai/kling-video/v1/standard/text-to-video"
)

ALLOWED_ORIGIN = os.getenv(
    "ALLOWED_ORIGIN",
    "*"
)

PORT = int(
    os.getenv(
        "PORT",
        "5000"
    )
)

DEBUG = (
    os.getenv(
        "FLASK_DEBUG",
        "false"
    ).lower()
    == "true"
)

REQUEST_TIMEOUT = 60

STATUS_TIMEOUT = 30

MAX_PROMPT_LENGTH = 2000

ALLOWED_DURATIONS = {
    "5",
    "8",
    "10"
}

ALLOWED_RATIOS = {
    "9:16",
    "16:9",
    "1:1"
}

# ============================================================
# LOGGING
# ============================================================

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s : %(message)s"
)

logger = logging.getLogger("ReelMind")

# ============================================================
# VALIDATION
# ============================================================

if not FAL_KEY:
    raise RuntimeError(
        "FAL_KEY environment variable missing."
    )

# ============================================================
# FLASK
# ============================================================

app = Flask(__name__)

CORS(
    app,
    resources={
        r"/api/*": {
            "origins": ALLOWED_ORIGIN
        }
    }
)

# ============================================================
# HEADERS
# ============================================================

FAL_HEADERS = {
    "Authorization": f"Key {FAL_KEY}",
    "Content-Type": "application/json"
}

# ============================================================
# UTILITIES
# ============================================================

def error(message, code=400):
    return jsonify({
        "success": False,
        "error": message
    }), code


def success(data):
    return jsonify({
        "success": True,
        "data": data
    })


def validate_prompt(prompt):
    prompt = (prompt or "").strip()

    if not prompt:
        return None

    if len(prompt) > MAX_PROMPT_LENGTH:
        prompt = prompt[:MAX_PROMPT_LENGTH]

    return prompt

# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/")
def home():
    return jsonify({
        "name": "ReelMind AI Backend",
        "status": "running",
        "version": "2.0"
    })


@app.get("/healthz")
def health():
    return jsonify({
        "status": "healthy",
        "model": FAL_MODEL,
        "time": int(time.time())
    })

# ============================================================
# API ROOT
# ============================================================

@app.route(
    "/api/generate",
    methods=[
        "GET",
        "POST",
        "OPTIONS"
    ]
)
def api():
    if request.method == "OPTIONS":
        return "", 204

    action = request.args.get(
        "action",
        ""
    ).lower()

    if action == "submit":
        return submit_generation()
    elif action == "status":
        return generation_status()
    elif action == "result":
        return generation_result()

    return error("Unknown action")

# ============================================================
# SUBMIT GENERATION
# ============================================================

def submit_generation():
    data = request.get_json(silent=True) or {}

    # ----------------------------
    # Read Input
    # ----------------------------

    prompt = validate_prompt(data.get("prompt"))

    duration = str(data.get("duration", "8"))

    ratio = data.get("aspect_ratio", "9:16")

    # ----------------------------
    # Validation
    # ----------------------------

    if not prompt:
        return error("Prompt is required.")

    if duration not in ALLOWED_DURATIONS:
        duration = "8"

    if ratio not in ALLOWED_RATIOS:
        ratio = "9:16"

    payload = {
        "prompt": prompt,
        "duration": duration,
        "aspect_ratio": ratio
    }

    logger.info("Submitting request to fal.ai")

    url = f"https://queue.fal.run/{FAL_MODEL}"

    # ----------------------------
    # Retry Logic
    # ----------------------------

    retries = 3
    last_error = None

    for attempt in range(retries):
        try:
            response = requests.post(
                url,
                headers=FAL_HEADERS,
                json=payload,
                timeout=REQUEST_TIMEOUT
            )

            if response.status_code >= 500:
                raise Exception("Fal server error")

            if not response.ok:
                try:
                    body = response.json()
                    message = body.get("error", response.text)
                except Exception:
                    message = response.text

                return error(message, response.status_code)

            result = response.json()

            logger.info("Generation request accepted")

            return jsonify(result)

        except Exception as e:
            last_error = e
            logger.warning(f"Retry {attempt+1}/{retries}: {e}")
            time.sleep(2)

    logger.error(f"Submit failed: {last_error}")

    return error("Unable to connect to fal.ai", 502)

# ============================================================
# STATUS
# ============================================================

def generation_status():
    request_id = request.args.get("request_id", "").strip()

    if not request_id:
        return error("request_id is required.")

    url = (
        f"https://queue.fal.run/"
        f"{FAL_MODEL}/requests/"
        f"{request_id}/status"
    )

    try:
        response = requests.get(
            url,
            headers=FAL_HEADERS,
            timeout=STATUS_TIMEOUT
        )

        if not response.ok:
            return error(response.text, response.status_code)

        return jsonify(response.json())

    except requests.RequestException as e:
        logger.exception(e)
        return error("Unable to fetch generation status.", 502)


# ============================================================
# RESULT
# ============================================================

def generation_result():
    request_id = request.args.get("request_id", "").strip()

    if not request_id:
        return error("request_id is required.")

    url = (
        f"https://queue.fal.run/"
        f"{FAL_MODEL}/requests/"
        f"{request_id}"
    )

    try:
        response = requests.get(
            url,
            headers=FAL_HEADERS,
            timeout=STATUS_TIMEOUT
        )

        if not response.ok:
            return error(response.text, response.status_code)

        result = response.json()

        logger.info("Video generated successfully.")

        return jsonify(result)

    except requests.RequestException as e:
        logger.exception(e)
        return error("Unable to fetch result.", 502)


# ============================================================
# GLOBAL ERROR HANDLER
# ============================================================

@app.errorhandler(404)
def not_found(e):
    return error("Endpoint not found.", 404)


@app.errorhandler(500)
def internal(e):
    logger.exception(e)
    return error("Internal server error.", 500)


# ============================================================
# AFTER REQUEST
# ============================================================

@app.after_request
def add_headers(response):
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Powered-By"] = "ReelMind AI"
    return response


# ============================================================
# STARTUP
# ============================================================

if __name__ == "__main__":
    logger.info("====================================")
    logger.info("ReelMind AI Backend Started")
    logger.info(f"Model : {FAL_MODEL}")
    logger.info(f"Port  : {PORT}")
    logger.info("====================================")

    app.run(
        host="0.0.0.0",
        port=PORT,
        debug=DEBUG
    )

# ============================================================
# END OF FILE
# ============================================================
