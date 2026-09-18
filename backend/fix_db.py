import sqlite3

def fix_db():
    conn = sqlite3.connect('swasthyasync.db')
    cursor = conn.cursor()
    
    # Create temp table
    cursor.execute("""
        CREATE TABLE doctors_temp (
            doctor_id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT,
            full_name TEXT NOT NULL,
            dept_id INTEGER,
            license_number TEXT,
            profile_image_url TEXT,
            max_daily_patients INTEGER DEFAULT 40,
            status TEXT DEFAULT 'Active',
            current_status TEXT DEFAULT 'Available',
            room_number TEXT DEFAULT 'TBD',
            FOREIGN KEY(dept_id) REFERENCES departments(dept_id)
        )
    """)
    
    # Copy data, providing dummy usernames and passwords
    cursor.execute("""
        INSERT INTO doctors_temp (doctor_id, full_name, dept_id, license_number, profile_image_url, max_daily_patients, status, room_number, password, current_status)
        SELECT doctor_id, full_name, dept_id, license_number, profile_image_url, max_daily_patients, status, room_number, password, current_status
        FROM doctors
    """)
    
    cursor.execute("UPDATE doctors_temp SET username = 'doctor' || doctor_id WHERE username IS NULL")
    
    # Drop old table
    cursor.execute("DROP TABLE doctors")
    
    # Rename temp table
    cursor.execute("ALTER TABLE doctors_temp RENAME TO doctors")
    
    conn.commit()
    conn.close()
    print("Database fixed!")

if __name__ == '__main__':
    fix_db()
