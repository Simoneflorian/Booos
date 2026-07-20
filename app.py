import os
import base64
import json
import io
from datetime import datetime
from flask import Flask, request, jsonify, send_file, render_template
from werkzeug.utils import secure_filename
import anthropic
from dotenv import load_dotenv
from excel_export import create_excel

load_dotenv()

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024  # 16 MB max upload

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp", "gif"}

client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

EXTRACTION_PROMPT = """Analysiere dieses Quittungsbild und extrahiere alle relevanten Daten.
Antworte NUR mit einem validen JSON-Objekt in exakt diesem Format (keine Erklärungen, kein Markdown):

{
  "haendler": "Name des Geschäfts",
  "haendler_adresse": "Strasse, PLZ Ort",
  "quittung_nr": "Quittungs- oder Rechnungsnummer",
  "kunden_nr": "Kundennummer",
  "datum": "DD.MM.YYYY",
  "uhrzeit": "HH:MM",
  "empfaenger_name": "Name des Empfängers/Kunden",
  "empfaenger_adresse": "Adresse des Empfängers",
  "artikel": [
    {
      "bezeichnung": "Artikelname",
      "menge": 1,
      "einzelpreis": 0.00,
      "gesamtpreis": 0.00
    }
  ],
  "zwischensumme": 0.00,
  "steuer": 0.00,
  "steuersatz": "7.7%",
  "gesamtbetrag": 0.00,
  "zahlungsart": "Bar/Karte/etc.",
  "waehrung": "CHF"
}

Falls ein Wert nicht lesbar oder nicht vorhanden ist, verwende null.
Zahlen immer als Dezimalzahl ohne Währungssymbol."""


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def encode_image(image_bytes: bytes, mime_type: str) -> str:
    return base64.standard_b64encode(image_bytes).decode("utf-8")


def analyze_receipt(image_bytes: bytes, mime_type: str) -> dict:
    image_data = encode_image(image_bytes, mime_type)

    message = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=1024,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": mime_type,
                            "data": image_data,
                        },
                    },
                    {
                        "type": "text",
                        "text": EXTRACTION_PROMPT,
                    },
                ],
            }
        ],
    )

    raw_text = message.content[0].text.strip()
    # Strip markdown code blocks if present
    if raw_text.startswith("```"):
        raw_text = raw_text.split("```")[1]
        if raw_text.startswith("json"):
            raw_text = raw_text[4:]
        raw_text = raw_text.strip()

    return json.loads(raw_text)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/game")
def game():
    return render_template("game.html")


@app.route("/api/analyze", methods=["POST"])
def analyze():
    if "file" not in request.files:
        return jsonify({"error": "Keine Datei hochgeladen"}), 400

    file = request.files["file"]

    if file.filename == "":
        return jsonify({"error": "Keine Datei ausgewählt"}), 400

    if not allowed_file(file.filename):
        return jsonify({"error": "Ungültiges Dateiformat. Erlaubt: PNG, JPG, JPEG, WEBP, GIF"}), 400

    image_bytes = file.read()
    ext = file.filename.rsplit(".", 1)[1].lower()
    mime_map = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
                "webp": "image/webp", "gif": "image/gif"}
    mime_type = mime_map.get(ext, "image/jpeg")

    try:
        receipt_data = analyze_receipt(image_bytes, mime_type)
    except json.JSONDecodeError as e:
        return jsonify({"error": f"Antwort konnte nicht geparst werden: {e}"}), 500
    except anthropic.APIError as e:
        return jsonify({"error": f"API-Fehler: {e}"}), 500

    return jsonify({"success": True, "data": receipt_data})


@app.route("/api/export", methods=["POST"])
def export():
    receipts = request.get_json()

    if not receipts or not isinstance(receipts, list) or len(receipts) == 0:
        return jsonify({"error": "Keine Quittungsdaten übergeben"}), 400

    excel_buffer = create_excel(receipts)

    filename = f"quittungen_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"

    return send_file(
        excel_buffer,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True,
        download_name=filename,
    )


@app.route("/api/download-vba")
def download_vba():
    vba_path = os.path.join(os.path.dirname(__file__), "vba_search.bas")
    return send_file(vba_path, as_attachment=True, download_name="vba_search.bas",
                     mimetype="text/plain")


if __name__ == "__main__":
    app.run(debug=True, port=5000)
