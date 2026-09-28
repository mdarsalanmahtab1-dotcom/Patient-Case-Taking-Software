import os
import requests
import fitz

def main():
    session_id = "sess_395cbfd9"
    url = f"http://127.0.0.1:8000/api/summary/{session_id}/pdf?regenerate=true"
    print(f"Requesting PDF from {url} ...")
    
    try:
        resp = requests.get(url, timeout=30)
        print(f"Status code: {resp.status_code}")
        
        if resp.status_code != 200:
            print("Error response:", resp.text)
            return
            
        pdf_bytes = resp.content
        print(f"Successfully received PDF ({len(pdf_bytes):,} bytes)")
        
        out_dir = os.path.join(os.path.dirname(__file__), "generated_pdfs")
        os.makedirs(out_dir, exist_ok=True)
        
        pdf_path = os.path.join(out_dir, "verify_sess_395cbfd9.pdf")
        with open(pdf_path, "wb") as f:
            f.write(pdf_bytes)
        print(f"Saved PDF to: {pdf_path}")
        
        # Render page 1 to PNG via PyMuPDF
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        print(f"Total pages: {len(doc)}")
        
        page = doc[0]
        pix = page.get_pixmap(dpi=150)
        png_path = os.path.join(out_dir, "verify_sess_395cbfd9.png")
        pix.save(png_path)
        print(f"Rendered Page 1 image to: {png_path}")
        
        # Copy to artifact folder for easy inspection
        artifact_dir = r"C:\Users\mdzee\.gemini\antigravity-ide\brain\d2250723-4ee9-436c-b7b9-cf15938f5258"
        if os.path.exists(artifact_dir):
            import shutil
            dest_png = os.path.join(artifact_dir, "verify_opd_sheet.png")
            shutil.copyfile(png_path, dest_png)
            print(f"Copied image to artifact dir: {dest_png}")
            
    except Exception as e:
        print(f"Verification failed with exception: {e}")

if __name__ == "__main__":
    main()
