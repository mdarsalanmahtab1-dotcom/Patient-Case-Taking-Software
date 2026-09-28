import os
import io
import queue
import threading
import logging
import asyncio
from jinja2 import Environment, FileSystemLoader
from playwright.sync_api import sync_playwright
from PIL import Image

# Setup Jinja2 environment
template_dir = os.path.join(os.path.dirname(__file__), "templates")
os.makedirs(template_dir, exist_ok=True)
env = Environment(loader=FileSystemLoader(template_dir))
logger = logging.getLogger(__name__)

class PDFEngine:
    def __init__(self):
        self.playwright = None
        self.browser = None
        self.req_queue = queue.Queue()
        self.thread = threading.Thread(target=self._run, daemon=True)
        self.started = False

    def _run(self):
        try:
            with sync_playwright() as p:
                self.playwright = p
                self.browser = p.chromium.launch(
                    args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
                )
                logger.info("Playwright browser started in dedicated thread.")
                while True:
                    task = self.req_queue.get()
                    if task is None:
                        break
                    html_content, res_queue = task
                    try:
                        page = self.browser.new_page()
                        page.set_content(html_content, wait_until="domcontentloaded")
                        pdf_bytes = page.pdf(
                            format="A4",
                            print_background=True,
                            margin={"top": "1cm", "right": "1cm", "bottom": "1cm", "left": "1cm"}
                        )
                        page.close()
                        res_queue.put(("ok", pdf_bytes))
                    except Exception as e:
                        logger.error(f"Playwright page error: {e}")
                        res_queue.put(("error", e))
        except Exception as e:
            logger.error(f"Playwright thread failed: {e}")

    async def start(self):
        if not self.started:
            self.thread.start()
            self.started = True

    async def stop(self):
        if self.started:
            self.req_queue.put(None)
            self.started = False

    def generate_pdf_sync(self, html_content: str) -> bytes:
        if not self.started:
            # Fallback for scripts directly calling generate_summary_pdf
            self.thread.start()
            self.started = True
            
        res_queue = queue.Queue()
        self.req_queue.put((html_content, res_queue))
        status, result = res_queue.get()
        if status == "error":
            raise result
        return result

pdf_engine = PDFEngine()

def _compress_image_to_base64(image_path: str) -> str:
    import base64
    import urllib.request
    
    if not image_path:
        return ""
        
    img_bytes = None
    clean_path = str(image_path).strip()
    
    # 1. Remote HTTP/HTTPS URL (e.g. Supabase Storage signed URL)
    if clean_path.startswith("http://") or clean_path.startswith("https://"):
        try:
            req = urllib.request.Request(
                clean_path,
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) SwasthyaSync/1.0"}
            )
            with urllib.request.urlopen(req, timeout=12) as resp:
                img_bytes = resp.read()
        except Exception as e:
            logger.error(f"Failed to fetch image from URL {clean_path[:80]}...: {e}")
            return ""
            
    # 2. Local file path
    elif os.path.exists(clean_path):
        try:
            with open(clean_path, "rb") as f:
                img_bytes = f.read()
        except Exception as e:
            logger.error(f"Failed to read local image file {clean_path}: {e}")
            return ""
            
    # 3. Fallback in uploads/ directory
    else:
        candidate1 = os.path.join(os.path.dirname(__file__), "uploads", os.path.basename(clean_path))
        candidate2 = os.path.join("uploads", os.path.basename(clean_path))
        if os.path.exists(candidate1):
            try:
                with open(candidate1, "rb") as f:
                    img_bytes = f.read()
            except Exception:
                pass
        elif os.path.exists(candidate2):
            try:
                with open(candidate2, "rb") as f:
                    img_bytes = f.read()
            except Exception:
                pass

    if not img_bytes:
        logger.warning(f"Could not load image bytes for path: {clean_path[:80]}")
        return ""

    try:
        with Image.open(io.BytesIO(img_bytes)) as img:
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")
            
            # Resize preserving aspect ratio (A4 high resolution)
            img.thumbnail((1200, 1600), Image.Resampling.LANCZOS)
            
            buffered = io.BytesIO()
            img.save(buffered, format="JPEG", quality=85)
            img_b64 = base64.b64encode(buffered.getvalue()).decode("utf-8")
            return f"data:image/jpeg;base64,{img_b64}"
    except Exception as e:
        logger.error(f"Error compressing image {clean_path[:80]}: {e}")
        return ""

async def generate_summary_pdf(session_id: str, context: dict) -> str:
    """
    context dict contains: patient, ai_summary, red_flag_active, priority_reason,
    filled_state, ocr_data, logo_b64, uploaded_images
    """
    template = env.get_template("medical_summary.html")
    
    # Process images if needed
    if "uploaded_images" in context:
        compressed_images = []
        for img_path in context["uploaded_images"]:
             b64 = _compress_image_to_base64(img_path)
             if b64:
                 compressed_images.append(b64)
        context["uploaded_images"] = compressed_images

    # Auto-inject Ayurvedic summary for AYUSH / integrative clinic mode
    raw_mode = str(context.get("clinic_mode", "allopathic")).lower().strip()
    is_ayush = "ayush" in raw_mode or "ayur" in raw_mode or raw_mode == "integrative"
    if is_ayush and "ayush_summary" not in context:
        try:
            from ayush_templates import calculate_prakriti
            filled_state = context.get("filled_state", {})
            cc = context.get("ai_summary", {}).get("chief_complaint", "")
            if not cc and isinstance(context.get("ai_summary"), dict):
                cc = context.get("ai_summary", {}).get("clinical_narrative", "")
            context["ayush_summary"] = calculate_prakriti(filled_state, cc)
        except Exception as e:
            logger.error(f"Error computing ayush_summary for PDF: {e}")

    html_content = template.render(**context)
    
    # Run the synchronous playwright generation in a background thread executor
    # so we don't block the FastAPI event loop
    loop = asyncio.get_event_loop()
    pdf_bytes = await loop.run_in_executor(None, pdf_engine.generate_pdf_sync, html_content)
    
    return pdf_bytes

