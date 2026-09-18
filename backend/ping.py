import urllib.request
import json
try:
    req = urllib.request.Request('http://127.0.0.1:8000/api/session/start', data=json.dumps({"patient_id": "91-1001-2001-3001", "phone_number": "9088260058", "full_name": "Ramesh Kumar", "department": "General Medicine"}).encode('utf-8'), headers={'Content-Type': 'application/json'})
    res = urllib.request.urlopen(req)
    print("Status:", res.status)
    print("Response:", res.read().decode())
except urllib.error.HTTPError as e:
    print("HTTPError:", e.code)
    print("Response:", e.read().decode())
