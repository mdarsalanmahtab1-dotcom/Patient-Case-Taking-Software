import urllib.request, urllib.error
try:
    req = urllib.request.Request('http://127.0.0.1:8000/api/summary/sess_422a8d91/pdf')
    urllib.request.urlopen(req)
except urllib.error.HTTPError as e:
    print(e.code, e.read().decode())
