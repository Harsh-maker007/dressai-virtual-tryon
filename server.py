"""
DressAI Backend Server — Fixed for IDM-VTON
Uses HuggingFace Spaces (free, no API key needed).
Tries multiple spaces to ensure availability.
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from gradio_client import Client, handle_file
from PIL import Image
import tempfile, base64, os, io, traceback, time

app = Flask(__name__)
CORS(app)

# HF Spaces to try in order (all free, no key needed)
HF_SPACES = [
    "Nymbo/Virtual-Try-On",
    "yisol/IDM-VTON",
    "CZTMT/IDM-VTON",
]


def b64_to_image(b64_str):
    """Decode base64 image, return PIL Image."""
    if "," in b64_str:
        b64_str = b64_str.split(",", 1)[1]
    return Image.open(io.BytesIO(base64.b64decode(b64_str))).convert("RGB")


def save_temp(pil_img, suffix=".jpg"):
    """Save PIL Image to a temp file, return path."""
    tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    pil_img.save(tmp.name, "JPEG", quality=95)
    tmp.close()
    return tmp.name


def file_to_b64(path):
    """Read image file → data URI string."""
    with open(path, "rb") as f:
        data = base64.b64encode(f.read()).decode()
    return f"data:image/png;base64,{data}"


def try_idm_vton(person_path, dress_path, garment_desc="dress"):
    """
    Call IDM-VTON on HuggingFace Spaces.
    Tries multiple spaces for reliability.
    """
    last_err = None
    for space in HF_SPACES:
        try:
            print(f"\n[DressAI] Trying space: {space}")
            client = Client(space, verbose=False)

            result = client.predict(
                dict={
                    "background": handle_file(person_path),
                    "layers": [],
                    "composite": None,
                },
                garm_img=handle_file(dress_path),
                garment_des=garment_desc,
                is_checked=True,
                is_checked_crop=False,
                denoise_steps=30,
                seed=42,
                api_name="/tryon",
            )

            # Result is (output_image_path, masked_image_path)
            result_path = result[0] if isinstance(result, (list, tuple)) else result
            print(f"[DressAI] ✓ Success with {space}: {result_path}")
            return result_path, space

        except Exception as e:
            print(f"[DressAI] ✗ {space} failed: {e}")
            last_err = e
            time.sleep(1)

    raise Exception(f"All spaces failed. Last error: {last_err}")


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "spaces": HF_SPACES})


@app.route("/tryon", methods=["POST"])
def tryon():
    """
    POST JSON: { "person": "<base64>", "dress": "<base64>", "description": "dress" }
    Returns:   { "success": true, "image": "<data URI>", "source": "<space name>" }
    """
    person_path = dress_path = None
    try:
        data = request.json
        if not data or "person" not in data or "dress" not in data:
            return jsonify({"success": False, "error": "Missing person or dress image"}), 400

        print("\n[DressAI] === New Try-On Request ===")

        # Decode images
        person_img = b64_to_image(data["person"])
        dress_img  = b64_to_image(data["dress"])
        desc       = data.get("description", "dress")

        # Resize for faster processing (IDM-VTON works well at 512x768 or 384x512)
        def resize_for_model(img, target_h=768):
            ratio = target_h / img.height
            return img.resize((int(img.width * ratio), target_h), Image.LANCZOS)

        person_img = resize_for_model(person_img, 768)
        dress_img  = resize_for_model(dress_img,  768)

        person_path = save_temp(person_img)
        dress_path  = save_temp(dress_img)

        print(f"[DressAI] Person: {person_img.size}, Dress: {dress_img.size}")
        print(f"[DressAI] Running IDM-VTON (may take 20-90s)...")

        result_path, used_space = try_idm_vton(person_path, dress_path, desc)
        result_b64 = file_to_b64(result_path)

        return jsonify({
            "success": True,
            "image"  : result_b64,
            "source" : used_space,
        })

    except Exception as e:
        print(f"[DressAI ERROR] {e}")
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

    finally:
        for p in [person_path, dress_path]:
            if p and os.path.exists(p):
                try: os.unlink(p)
                except: pass


if __name__ == "__main__":
    print("=" * 55)
    print("  DressAI Backend — IDM-VTON Virtual Try-On")
    print(f"  Spaces: {', '.join(HF_SPACES)}")
    print("  Listening on http://localhost:5501")
    print("=" * 55)
    app.run(host="0.0.0.0", port=5501, debug=False, threaded=True)
