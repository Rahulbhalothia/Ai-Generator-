# ============================================================
# ReelMind AI Backend
# app.py (Production Ready)
# Part 1 - Configuration + Security + Flask
# ============================================================

import os
import time
import logging
import requests

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

# ============================================================
# LOAD ENVIRONMENT
# ============================================================

load_dotenv()

# ============================================================
# ENVIRONMENT VARIABLES
# ============================================================

FAL_KEY = os.getenv("FAL_KEY")

FAL_MODEL = os.getenv(
    "FAL_MODEL",
    "fal-ai/kling-video/v1/standard/text-to-video"
)

PORT = int(os.getenv("PORT", "5000"))

DEBUG = (
    os.getenv("FLASK_DEBUG", "false").lower() == "true"
)

ALLOWED_ORIGIN = os.getenv(
    "ALLOWED_ORIGIN",
    "*"
)

# ============================================================
# APP CONFIG
# ============================================================

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
# VALIDATE ENV
# ============================================================

if not FAL_KEY:
    raise RuntimeError(
        "FAL_KEY not found. Please create a .env file."
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
# RESPONSE HELPERS
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


# ============================================================
# VALIDATION
# ============================================================

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

        "version": "3.0",

        "status": "running",

        "model": FAL_MODEL

    })


@app.get("/healthz")
def health():

    return jsonify({

        "status": "healthy",

        "timestamp": int(time.time())

    })


# ============================================================
# API ROUTER
# ============================================================

@app.route(
    "/api/generate",
    methods=["GET", "POST", "OPTIONS"]
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

    return error("Unknown action", 404)

# ============================================================
# PART 2 STARTS FROM submit_generation()
# ============================================================# ============================================================
# SUBMIT GENERATION
# ============================================================

def submit_generation():

    data = request.get_json(silent=True) or {}

    prompt = validate_prompt(data.get("prompt"))

    duration = str(data.get("duration", "8"))

    ratio = data.get("aspect_ratio", "9:16")

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

    url = f"https://queue.fal.run/{FAL_MODEL}"

    retries = 3

    for attempt in range(retries):

        try:

            logger.info(
                f"Submitting request ({attempt+1}/{retries})"
            )

            response = requests.post(
                url,
                headers=FAL_HEADERS,
                json=payload,
                timeout=REQUEST_TIMEOUT
            )

            if response.status_code >= 500:
                raise Exception("Fal temporary server error")

            if not response.ok:

                try:
                    body = response.json()
                    message = body.get(
                        "error",
                        response.text
                    )
                except Exception:
                    message = response.text

                return error(
                    message,
                    response.status_code
                )

            logger.info("Generation submitted.")

            return jsonify(response.json())

        except Exception as e:

            logger.warning(str(e))

            if attempt == retries - 1:
                return error(
                    "Unable to connect to fal.ai",
                    502
                )

            time.sleep(2)


# ============================================================
# STATUS
# ============================================================

def generation_status():

    request_id = request.args.get(
        "request_id",
        ""
    ).strip()

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

            return error(
                response.text,
                response.status_code
            )

        return jsonify(response.json())

    except requests.RequestException:

        return error(
            "Unable to fetch generation status.",
            502
        )


# ============================================================
# RESULT
# ============================================================

def generation_result():

    request_id = request.args.get(
        "request_id",
        ""
    ).strip()

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

            return error(
                response.text,
                response.status_code
            )

        logger.info(
            "Generation completed."
        )

        return jsonify(
            response.json()
        )

    except requests.RequestException:

        return error(
            "Unable to fetch generated video.",
            502
        )

# ============================================================
# PART 3 STARTS FROM ERROR HANDLERS
# ============================================================# ============================================================
# GLOBAL ERROR HANDLERS
# ============================================================

@app.errorhandler(404)
def not_found(e):

    return error(
        "Endpoint not found.",
        404
    )


@app.errorhandler(405)
def method_not_allowed(e):

    return error(
        "Method not allowed.",
        405
    )


@app.errorhandler(500)
def internal_server_error(e):

    logger.exception(e)

    return error(
        "Internal server error.",
        500
    )


# ============================================================
# AFTER REQUEST
# ============================================================

@app.after_request
def add_headers(response):

    response.headers["Cache-Control"] = "no-store"

    response.headers["X-Powered-By"] = "ReelMind AI"

    response.headers["Access-Control-Allow-Headers"] = (
        "Content-Type, Authorization"
    )

    response.headers["Access-Control-Allow-Methods"] = (
        "GET, POST, OPTIONS"
    )

    return response


# ============================================================
# STARTUP
# ============================================================

if __name__ == "__main__":

    logger.info("=" * 50)
    logger.info("🚀 ReelMind AI Backend Started")
    logger.info(f"Model : {FAL_MODEL}")
    logger.info(f"Port  : {PORT}")
    logger.info("Backend Status : READY")
    logger.info("=" * 50)

    app.run(
        host="0.0.0.0",
        port=PORT,
        debug=DEBUG
    )


# ============================================================
# END OF FILE
# ============================================================
