import os
import base64
import json
from flask import Flask, request, jsonify, render_template
import anthropic
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024

client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

SEAL_PROMPT = """Du bist ein Naruto-Handsiegelexperte. Analysiere dieses Bild und erkenne, ob die Person eines der 12 Naruto-Handsiegel (忍術の印) zeigt.

Die 12 Siegel sind:
- Ne (Ratte/Rat) 子: Beide Zeigefinger übereinander gelegt
- Ushi (Ochse/Ox) 丑: Rechte Hand umschließt linke, Daumen berühren sich
- Tora (Tiger) 寅: Hände zusammen, beide Zeigefinger zeigen nach oben
- U (Hase/Hare) 卯: Eine Hand macht eine Pistolenform
- Tatsu (Drache/Dragon) 辰: Fäuste berühren sich mit Knöcheln
- Mi (Schlange/Snake) 巳: Finger ineinander verschränkt, rechter Daumen oben
- Uma (Pferd/Horse) 午: Rechte Hand flach, linke Faust darunter
- Hitsuji (Widder/Ram) 未: Hände verschränkt, Zeigefinger nach oben
- Saru (Affe/Monkey) 申: Linke Hand umschließt rechte
- Tori (Vogel/Bird) 酉: Rechter Zeige- und Mittelfinger zeigen, linke Hand greift
- Inu (Hund/Dog) 戌: Linke Hand auf rechter Faust
- I (Wildschwein/Boar) 亥: Alle Finger ineinander verschränkt, flach

Antworte NUR mit validem JSON in exakt diesem Format (kein Markdown, keine Erklärungen):

{
  "detected": true,
  "seal": "Tiger",
  "seal_kanji": "寅",
  "seal_japanese": "Tora",
  "jutsu": "Katon: Gokakyu no Jutsu",
  "jutsu_de": "Feuerstil: Feuerball-Jutsu",
  "element": "fire",
  "confidence": "high",
  "description": "Eine mächtige Feuerball-Technik, die einen massiven Feuerball ausstößt"
}

Wenn kein Handsiegel erkannt wird, antworte mit:
{
  "detected": false,
  "seal": null,
  "seal_kanji": null,
  "seal_japanese": null,
  "jutsu": null,
  "jutsu_de": null,
  "element": null,
  "confidence": null,
  "description": null
}

Element muss eines von sein: fire, water, lightning, earth, wind, shadow, smoke, energy

Jutsu-Zuordnung pro Siegel:
- Rat (Ne): Kage Bunshin no Jutsu → element: shadow
- Ox (Ushi): Suiton: Suiro no Jutsu → element: water
- Tiger (Tora): Katon: Gokakyu no Jutsu → element: fire
- Hare (U): Chidori → element: lightning
- Dragon (Tatsu): Kuchiyose no Jutsu → element: smoke
- Snake (Mi): Doton: Doryudan → element: earth
- Horse (Uma): Katon: Ryuka no Jutsu → element: fire
- Ram (Hitsuji): Henge no Jutsu → element: smoke
- Monkey (Saru): Futon: Rasengan → element: wind
- Bird (Tori): Raikiri → element: lightning
- Dog (Inu): Sanju Rashomon → element: energy
- Boar (I): Hakke Hasangeki → element: energy"""


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/identify-seal", methods=["POST"])
def identify_seal():
    data = request.get_json()
    if not data or "image" not in data:
        return jsonify({"error": "Kein Bild übermittelt"}), 400

    image_data = data["image"]
    if "," in image_data:
        image_data = image_data.split(",", 1)[1]

    try:
        message = client.messages.create(
            model="claude-opus-4-6",
            max_tokens=512,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/jpeg",
                                "data": image_data,
                            },
                        },
                        {"type": "text", "text": SEAL_PROMPT},
                    ],
                }
            ],
        )

        raw = message.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()

        result = json.loads(raw)
        return jsonify(result)

    except json.JSONDecodeError as e:
        return jsonify({"error": f"Antwort konnte nicht geparst werden: {e}"}), 500
    except anthropic.APIError as e:
        return jsonify({"error": f"API-Fehler: {e}"}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5000)
