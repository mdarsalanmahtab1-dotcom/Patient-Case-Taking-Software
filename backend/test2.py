import json
import urllib.request, urllib.error

# Start session
req_start = urllib.request.Request('http://127.0.0.1:8000/api/session/start', data=json.dumps({"patient_name": "Test"}).encode('utf-8'), headers={'Content-Type': 'application/json'})
res = urllib.request.urlopen(req_start)
data = json.loads(res.read().decode())
session_id = data.get("session_id")
print("Session:", session_id)

try:
    req = urllib.request.Request(f'http://127.0.0.1:8000/api/summary/{session_id}/pdf')
    urllib.request.urlopen(req)
except urllib.error.HTTPError as e:
    print("Error:", e.code, e.read().decode())
