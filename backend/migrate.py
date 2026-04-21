"""
Migration: Multi-Screen-Gruppen
Fügt group_id zu screens und playlists hinzu, erstellt screen_groups Tabelle.
"""
from app.database import engine
from sqlalchemy import text

def run():
    with engine.connect() as conn:
        # 1. screen_groups Tabelle erstellen (falls nicht vorhanden)
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS screen_groups (
                id SERIAL PRIMARY KEY,
                name VARCHAR NOT NULL,
                owner_id INTEGER REFERENCES users(id)
            )
        """))

        # 2. group_id zu screens hinzufügen
        conn.execute(text("""
            ALTER TABLE screens
            ADD COLUMN IF NOT EXISTS group_id INTEGER REFERENCES screen_groups(id)
        """))

        # 3. group_id zu playlists hinzufügen
        conn.execute(text("""
            ALTER TABLE playlists
            ADD COLUMN IF NOT EXISTS group_id INTEGER REFERENCES screen_groups(id)
        """))

        # 4. screen_id in playlists nullable machen
        conn.execute(text("""
            ALTER TABLE playlists
            ALTER COLUMN screen_id DROP NOT NULL
        """))

        # 5. openweather_key zu users hinzufügen
        conn.execute(text("""
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS openweather_key VARCHAR
        """))

        # 6. push_subscription zu users hinzufügen
        conn.execute(text("""
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS push_subscription TEXT
        """))

        # 7. role und org_owner_id zu users hinzufügen
        conn.execute(text("""
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS role VARCHAR NOT NULL DEFAULT 'owner'
        """))
        conn.execute(text("""
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS org_owner_id INTEGER REFERENCES users(id)
        """))

        # 8. invitations Tabelle erstellen
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS invitations (
                id SERIAL PRIMARY KEY,
                token VARCHAR UNIQUE NOT NULL,
                org_owner_id INTEGER REFERENCES users(id),
                role VARCHAR NOT NULL DEFAULT 'editor',
                created_at TIMESTAMPTZ DEFAULT now(),
                expires_at TIMESTAMPTZ NOT NULL,
                used BOOLEAN DEFAULT FALSE
            )
        """))

        conn.commit()
        print("Migration erfolgreich abgeschlossen.")

if __name__ == "__main__":
    run()
