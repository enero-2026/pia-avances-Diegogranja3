from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict
import bcrypt
from database import init_db, get_user, create_user

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Coordenadas en memoria
coordenadas: Dict[str, dict] = {}

# Conexiones WebSocket activas { user_id: WebSocket }
conexiones: Dict[str, WebSocket] = {}

@app.on_event("startup")
def startup():
    init_db()

# --- Auth ---

class RegisterBody(BaseModel):
    nombre: str
    correo: str
    password: str

class LoginBody(BaseModel):
    correo: str
    password: str

@app.post("/register")
def register(body: RegisterBody):
    if get_user(body.correo):
        raise HTTPException(status_code=400, detail="Correo ya registrado")
    hashed = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode()
    user = create_user(body.nombre, body.correo, hashed)
    return { "id": user["id"], "nombre": user["nombre"], "correo": user["correo"] }

@app.post("/login")
def login(body: LoginBody):
    user = get_user(body.correo)
    if not user:
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    if not bcrypt.checkpw(body.password.encode(), user["password"].encode()):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    return { "id": user["id"], "nombre": user["nombre"], "correo": user["correo"] }

# --- Ubicación REST fallback ---

@app.get("/ubicacion/{correo}")
def get_ubicacion(correo: str):
    if correo not in coordenadas:
        raise HTTPException(status_code=404, detail="Sin ubicación disponible")
    return coordenadas[correo]

# --- WebSocket ---

@app.websocket("/ws/{correo}")
async def websocket_endpoint(websocket: WebSocket, correo: str):
    await websocket.accept()
    conexiones[correo] = websocket
    try:
        while True:
            data = await websocket.receive_json()
            # Guardar coords en memoria
            coordenadas[correo] = {
                "correo": correo,
                "lat": data["lat"],
                "lng": data["lng"],
            }
            # Reenviar a todos los demás conectados
            for other_correo, ws in conexiones.items():
                if other_correo != correo:
                    try:
                        await ws.send_json(coordenadas[correo])
                    except:
                        pass
    except WebSocketDisconnect:
        conexiones.pop(correo, None)