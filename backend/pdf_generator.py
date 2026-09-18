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
                        page.set_content(html_content, wait_until="networkidle")
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
    if not os.path.exists(image_path):
        return ""
    try:
        with Image.open(image_path) as img:
            # Convert to RGB if necessary (e.g., if RGBA)
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")
            
            # Resize preserving aspect ratio
            img.thumbnail((1200, 1600), Image.Resampling.LANCZOS)
            
            # Save to BytesIO as JPEG
            buffered = io.BytesIO()
            img.save(buffered, format="JPEG", quality=80)
            img_b64 = base64.b64encode(buffered.getvalue()).decode("utf-8")
            return f"data:image/jpeg;base64,{img_b64}"
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Error compressing image {image_path}: {e}")
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

    html_content = template.render(**context)
    
    # Run the synchronous playwright generation in a background thread executor
    # so we don't block the FastAPI event loop
    loop = asyncio.get_event_loop()
    pdf_bytes = await loop.run_in_executor(None, pdf_engine.generate_pdf_sync, html_content)
    
    return pdf_bytes

