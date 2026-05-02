import sqlite3
import os

DB_PATH = os.getenv("DB_PATH", "./db.sqlite")

def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_conn()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            correo TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()

def get_user(correo: str):
    conn = get_conn()
    user = conn.execute("SELECT * FROM usuarios WHERE correo = ?", (correo,)).fetchone()
    conn.close()
    return dict(user) if user else None

def create_user(nombre: str, correo: str, password: str):
    conn = get_conn()
    conn.execute("INSERT INTO usuarios (nombre, correo, password) VALUES (?, ?, ?)", (nombre, correo, password))
    conn.commit()
    user = conn.execute("SELECT * FROM usuarios WHERE correo = ?", (correo,)).fetchone()
    conn.close()
    return dict(user)