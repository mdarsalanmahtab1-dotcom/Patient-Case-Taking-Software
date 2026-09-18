from fpdf import FPDF
from jinja2 import Template

_TEMPLATE_STR = """
<!DOCTYPE html>
<html>
<head>
<style>
    body { font-family: sans-serif; margin: 0; padding: 20px; color: #333; }
    .header-banner { background-color: #dc2626; color: white; padding: 15px; font-weight: bold; text-align: center; font-size: 18px; margin-bottom: 20px;}
    h1 { margin-top: 0; }
    .header-info { margin-bottom: 20px; border-bottom: 2px solid #ccc; padding-bottom: 10px; }
    .header-info p { margin: 4px 0; }
    h2 { font-size: 16px; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-top: 25px; }
    .vitals p { margin: 8px 0; font-family: monospace; font-size: 14px; }
    .qa-box { margin-bottom: 10px; }
    .qa-box strong { display: block; }
    .documents { background: #f8fafc; padding: 15px; border-radius: 5px; margin-top: 15px; }
    .abnormal { color: #dc2626; font-weight: bold; }
    .consultation-box { border: 2px solid #94a3b8; height: 300px; margin-top: 15px; border-radius: 5px; }
    .footer { font-size: 10px; color: #64748b; margin-top: 30px; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 10px; }
</style>
</head>
<body>
    <div class="header-banner">
        PRIORITY ALERT: TEST
    </div>

    <h1>Pre-Consultation Summary</h1>
    <div class="header-info">
        <p><strong>Name:</strong> Test</p>
        <p><strong>Age:</strong> 25</p>
        <p><strong>Sex:</strong> M</p>
    </div>

    <h2>Vitals</h2>
    <div class="vitals">
        <p>BP: ______ &nbsp;&nbsp; HR: ______ bpm &nbsp;&nbsp; Temp: ______ °F &nbsp;&nbsp; SpO2: ______%</p>
        <p>Height: ______ cm &nbsp;&nbsp; Weight: ______ kg &nbsp;&nbsp; BMI: ______</p>
    </div>
</body>
</html>
"""

pdf=FPDF()
pdf.add_page()
pdf.write_html(_TEMPLATE_STR)
print("Success")
