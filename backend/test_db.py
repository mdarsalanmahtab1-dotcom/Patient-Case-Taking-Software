import sqlite3

conn = sqlite3.connect('swasthyasync.db')
row = conn.execute("SELECT count(*) FROM patient_sessions WHERE session_id = 'sess_ac263be7d6a54cdba836bcfdcf9b3c40'").fetchone()
print(f"Count: {row[0]}")
conn.close()
