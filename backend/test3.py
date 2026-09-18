from fpdf import FPDF
pdf=FPDF()
pdf.add_page()
pdf.write_html('<html><body><h1>Test</h1><style>body {color:red;}</style></body></html>')
print("Success")
