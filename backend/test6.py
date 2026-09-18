import json
import urllib.request, urllib.error
import urllib.parse

try:
    req_pat = urllib.request.Request('http://127.0.0.1:8000/api/patient/lookup-or-create', data=json.dumps({"phone": "12345"}).encode('utf-8'), headers={'Content-Type': 'application/json'})
    res_pat = urllib.request.urlopen(req_pat)
    pat_id = json.loads(res_pat.read().decode())["patient_id"]

    req_start = urllib.request.Request('http://127.0.0.1:8000/api/session/start', data=json.dumps({"patient_id": pat_id, "clinic_mode": "walk-in"}).encode('utf-8'), headers={'Content-Type': 'application/json'})
    res_start = urllib.request.urlopen(req_start)
    session_id = json.loads(res_start.read().decode())["session_id"]
    print("Session:", session_id)

    req_pdf = urllib.request.Request(f'http://127.0.0.1:8000/api/summary/{session_id}/pdf')
    urllib.request.urlopen(req_pdf)
    print("PDF SUCCESS")
except urllib.error.HTTPError as e:
    print("Error:", e.code, e.read().decode())
except Exception as e:
    print(e)
