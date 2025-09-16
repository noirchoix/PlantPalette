import os, io, base64
from fastapi import FastAPI, File, UploadFile, Form
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
import httpx
from openai import OpenAI

PLANTNET_KEY = os.getenv("PLANTNET_KEY")
PLANTNET_PROJECT = "all"
OPENAI_KEY = os.getenv("OPENAI_API_KEY")

client = OpenAI(api_key=OPENAI_KEY)
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/plantnet")
async def identify_plant(
    images: list[UploadFile] = File(...),
    organs: list[str] = Form(None),
    no_reject: bool = Form(False)
):
    """
    1️⃣ Send images to PlantNet (with scaling & JPEG compression)
    2️⃣ If PlantNet confidence < 0.8, call GPT-4-Vision for boosted description
    Returns: { species, confidence, boost_captions?, status }
    """
    # ---- Prepare PlantNet payload ----
    files = []
    for idx, image in enumerate(images):
        raw = await image.read()
        img = Image.open(io.BytesIO(raw)).convert("RGB")
        img.thumbnail((1280, 1280))
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=90)
        buf.seek(0)
        files.append(("images", (image.filename, buf, "image/jpeg")))
        if organs and idx < len(organs):
            files.append(("organs", (None, organs[idx])))

    url = (
        f"https://my-api.plantnet.org/v2/identify/{PLANTNET_PROJECT}"
        f"?api-key={PLANTNET_KEY}"
        + ("&no-reject=true" if no_reject else "")
    )

    async with httpx.AsyncClient(timeout=60) as client_http:
        try:
            r = await client_http.post(url, files=files)
            r.raise_for_status()
            plantnet_json = r.json()
        except httpx.HTTPStatusError as e:
            return JSONResponse({"error": str(e)}, status_code=e.response.status_code)

    # ---- Extract top prediction & confidence ----
    best = None
    confidence = 0.0
    if plantnet_json.get("results"):
        first = plantnet_json["results"][0]
        confidence = float(first.get("score", 0.0))
        species = first.get("species", {}).get("scientificNameWithoutAuthor", "Unknown")
        best = species
    else:
        species = "No match"

    # ---- Optional GPT-4-Vision Boost ----
    boost_captions = []
    status = "plantnet_only"
    if confidence < 0.8 and OPENAI_KEY:
        status = "boosted"
        for image in images:
            raw = await image.read()
            # NOTE: We already consumed .read() above. If you need to reuse, 
            # store raw earlier or rewind buffer.
            # Here we rewind from first buffer for simplicity:
            image.file.seek(0)
            raw = image.file.read()
            b64 = base64.b64encode(raw).decode()
            data_uri = f"data:image/jpeg;base64,{b64}"

            resp = client.chat.completions.create(
                model="gpt-4-vision-preview",
                messages=[{
                    "role": "user",
                    "content": [
                        {"type": "text",
                         "text": "Describe this image and suggest likely plant species or context."},
                        {"type": "image_url", "image_url": {"url": data_uri}}
                    ]
                }],
                max_tokens=300
            )
            content = resp.choices[0].message.content
            caption = content.strip() if content is not None else "No caption returned"
            boost_captions.append({"filename": image.filename, "caption": caption})

    return {
        "species": best,
        "confidence": confidence,
        "status": status,
        "boost_captions": boost_captions if boost_captions else None
    }
