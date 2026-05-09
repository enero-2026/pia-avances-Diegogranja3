import { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Animated, PanResponder,
  TouchableOpacity, TextInput, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Map, Camera, UserLocation, Marker } from '@maplibre/maplibre-react-native';
import * as Location from 'expo-location';
import { useAuth } from '../context/AuthContext';
import { WS_URL } from '../constants/api';

const PANEL_MIN = 0.45;
const PANEL_MAX = 0.85;

type PersonaUbicacion = {
  correo: string;
  lat: number;
  lng: number;
};

type Mensaje = {
  de: string;      // correo del remitente
  texto: string;
  hora: string;
  propio: boolean;
};

// { correo_amigo: Mensaje[] }
type Conversaciones = Record<string, Mensaje[]>;

export default function HomeScreen() {
  const { user } = useAuth();
  const [permitted, setPermitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [personas, setPersonas] = useState<PersonaUbicacion[]>([]);
  const [compartiendo, setCompartiendo] = useState(true);

  // WebSocket
  const wsRef = useRef<WebSocket | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const compartidiendoRef = useRef(true);
  const [wsEstado, setWsEstado] = useState<'conectado' | 'desconectado' | 'reconectando'>('desconectado');

  // Chat privado
  const [chatAbierto, setChatAbierto] = useState<string | null>(null); // correo del amigo
  const [conversaciones, setConversaciones] = useState<Conversaciones>({});
  const [inputMensaje, setInputMensaje] = useState('');

  // Panel
  const panelHeight = useRef(new Animated.Value(PANEL_MIN)).current;
  const lastHeight = useRef(PANEL_MIN);

  useEffect(() => {
    compartidiendoRef.current = compartiendo;
  }, [compartiendo]);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setError('Permiso de ubicación denegado'); return; }
      setPermitted(true);
    })();
  }, []);

  // --- WebSocket con reconexión manual ---
  const conectarWS = useCallback(() => {
    if (!user) return;

    // Limpiar conexión previa
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
    }
    if (intervalRef.current) clearInterval(intervalRef.current);

    setWsEstado('reconectando');
    const ws = new WebSocket(`${WS_URL}/ws/${user.correo}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsEstado('conectado');

      intervalRef.current = setInterval(async () => {
        if (!compartidiendoRef.current) return;
        const loc = await Location.getCurrentPositionAsync({});
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
          }));
        }
      }, 4000);
    };

    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);

      // Mensaje privado recibido
      if (data.tipo === 'mensaje') {
        const remitente = data.de;
        const nuevoMsg: Mensaje = {
          de: remitente,
          texto: data.mensaje,
          hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          propio: false,
        };
        setConversaciones(prev => ({
          ...prev,
          [remitente]: [...(prev[remitente] ?? []), nuevoMsg],
        }));
        return;
      }

      // Confirmación de mensaje enviado (para agregarlo a la conv local)
      if (data.tipo === 'mensaje_enviado') {
        return; // ya lo agregamos al enviar
      }

      // Coordenadas de otro usuario
      if (data.correo) {
        setPersonas(prev => {
          const existe = prev.find(p => p.correo === data.correo);
          if (existe) return prev.map(p => p.correo === data.correo ? data : p);
          return [...prev, data];
        });
      }
    };

    ws.onerror = () => setWsEstado('desconectado');

    ws.onclose = () => {
      setWsEstado('desconectado');
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [user]);

  useEffect(() => {
    if (!permitted || !user) return;
    conectarWS();
    return () => {
      wsRef.current?.close();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [permitted, user]);

  // --- Enviar mensaje privado ---
  const enviarMensaje = () => {
    if (!chatAbierto || !inputMensaje.trim() || !wsRef.current) return;
    if (wsRef.current.readyState !== WebSocket.OPEN) return;

    const texto = inputMensaje.trim();
    wsRef.current.send(JSON.stringify({
      tipo: 'mensaje',
      para: chatAbierto,
      mensaje: texto,
    }));

    const nuevoMsg: Mensaje = {
      de: user!.correo,
      texto,
      hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      propio: true,
    };
    setConversaciones(prev => ({
      ...prev,
      [chatAbierto]: [...(prev[chatAbierto] ?? []), nuevoMsg],
    }));
    setInputMensaje('');
  };

  // --- Panel drag ---
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gesture) => {
        const delta = -gesture.dy / 800;
        const next = Math.min(PANEL_MAX, Math.max(PANEL_MIN, lastHeight.current + delta));
        panelHeight.setValue(next);
      },
      onPanResponderRelease: (_, gesture) => {
        const delta = -gesture.dy / 800;
        const next = Math.min(PANEL_MAX, Math.max(PANEL_MIN, lastHeight.current + delta));
        const snapped = next > (PANEL_MIN + PANEL_MAX) / 2 ? PANEL_MAX : PANEL_MIN;
        Animated.spring(panelHeight, { toValue: snapped, useNativeDriver: false }).start();
        lastHeight.current = snapped;
      },
    })
  ).current;

  const heightInterpolated = panelHeight.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const estadoColor = wsEstado === 'conectado' ? '#22C55E' : wsEstado === 'reconectando' ? '#F59E0B' : '#EF4444';
  const estadoTexto = wsEstado === 'conectado' ? 'Conectado' : wsEstado === 'reconectando' ? 'Conectando...' : 'Sin conexión';

  if (error) return <View style={styles.center}><Text>{error}</Text></View>;
  if (!permitted) return <View style={styles.center}><Text>Obteniendo ubicación...</Text></View>;

  // --- Chat abierto ---
  if (chatAbierto) {
    const mensajes = conversaciones[chatAbierto] ?? [];
    const nombreAmigo = chatAbierto.split('@')[0];
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.chatContainer}>
          {/* Header */}
          <View style={styles.chatHeader}>
            <TouchableOpacity onPress={() => setChatAbierto(null)} style={styles.backBtn}>
              <Text style={styles.backBtnText}>← Volver</Text>
            </TouchableOpacity>
            <Text style={styles.chatTitle}>{nombreAmigo}</Text>
          </View>

          {/* Mensajes */}
          <ScrollView
            style={styles.mensajesScroll}
            contentContainerStyle={styles.mensajesContent}
          >
            {mensajes.length === 0 && (
              <Text style={styles.empty}>Aún no hay mensajes. ¡Saluda!</Text>
            )}
            {mensajes.map((m, i) => (
              <View key={i} style={[styles.burbuja, m.propio ? styles.burbujaPropia : styles.burbujaAjena]}>
                <Text style={[styles.burbujaTexto, m.propio ? styles.burbujaTextoPropio : {}]}>{m.texto}</Text>
                <Text style={styles.burbujaHora}>{m.hora}</Text>
              </View>
            ))}
          </ScrollView>

          {/* Input */}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Escribe un mensaje..."
              value={inputMensaje}
              onChangeText={setInputMensaje}
              onSubmitEditing={enviarMensaje}
              returnKeyType="send"
            />
            <TouchableOpacity
              style={[styles.sendBtn, !inputMensaje.trim() && styles.sendBtnDisabled]}
              onPress={enviarMensaje}
              disabled={!inputMensaje.trim()}
            >
              <Text style={styles.sendBtnText}>Enviar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // --- Pantalla principal ---
  return (
    <View style={styles.container}>
      <Map style={styles.map} mapStyle="https://tiles.openfreemap.org/styles/liberty">
        {compartiendo && <UserLocation />}
        <Camera initialViewState={{ zoom: 15 }} trackUserLocation="course" />
        {personas.map(p => (
          <Marker key={p.correo} lngLat={[p.lng, p.lat]}>
            <View style={styles.marker}>
              <Text style={styles.markerText}>{p.correo.split('@')[0]}</Text>
            </View>
          </Marker>
        ))}
      </Map>

      <Animated.View style={[styles.panel, { height: heightInterpolated }]}>
        <View {...panResponder.panHandlers} style={styles.handleArea}>
          <View style={styles.handle} />

          {/* Fila: título + estado + reconectar */}
          <View style={styles.headerRow}>
            <Text style={styles.title}>Mi ubicación</Text>
            <View style={styles.wsRow}>
              <View style={[styles.wsDot, { backgroundColor: estadoColor }]} />
              <Text style={[styles.wsTexto, { color: estadoColor }]}>{estadoTexto}</Text>
              <TouchableOpacity style={styles.reconectarBtn} onPress={conectarWS}>
                <Text style={styles.reconectarTexto}>↺ Reconectar</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.subtitle}>
            {personas.length === 0 ? 'Sin personas conectadas' : `${personas.length} persona(s) en línea`}
          </Text>

          <TouchableOpacity
            style={[styles.toggleBtn, compartiendo ? styles.toggleOn : styles.toggleOff]}
            onPress={() => setCompartiendo(prev => !prev)}
          >
            <Text style={styles.toggleText}>
              {compartiendo ? '📍 Compartiendo ubicación' : '🔴 Ubicación pausada'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {personas.map(p => {
            const noLeidos = (conversaciones[p.correo] ?? []).filter(m => !m.propio).length;
            return (
              <View key={p.correo} style={styles.personaRow}>
                <View style={styles.dot} />
                <Text style={styles.personaNombre}>{p.correo.split('@')[0]}</Text>
                <TouchableOpacity
                  style={styles.chatBtn}
                  onPress={() => setChatAbierto(p.correo)}
                >
                  <Text style={styles.chatBtnText}>
                    💬 Chat{noLeidos > 0 ? ` (${noLeidos})` : ''}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
          {personas.length === 0 && (
            <Text style={styles.empty}>Las personas aparecerán aquí cuando estén activas</Text>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Marker
  marker: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'white',
  },
  markerText: { color: 'white', fontSize: 11, fontWeight: '700' },

  // Panel
  panel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'white',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12, shadowRadius: 12, elevation: 16,
  },
  handleArea: {
    alignItems: 'center', paddingTop: 12, paddingBottom: 8, paddingHorizontal: 20,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#D1D5DB', marginBottom: 12,
  },

  // Header row
  headerRow: {
    width: '100%', flexDirection: 'row',
    justifyContent: 'space-between', alignItems: 'center',
  },
  title: { fontSize: 18, fontWeight: '700', color: '#111827' },
  wsRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  wsDot: { width: 8, height: 8, borderRadius: 4 },
  wsTexto: { fontSize: 11, fontWeight: '600' },
  reconectarBtn: {
    marginLeft: 6,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 12,
  },
  reconectarTexto: { fontSize: 11, fontWeight: '700', color: '#3B82F6' },

  subtitle: { fontSize: 13, color: '#6B7280', marginTop: 4, alignSelf: 'flex-start' },
  toggleBtn: {
    marginTop: 10, paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, alignSelf: 'center',
  },
  toggleOn: { backgroundColor: '#DCFCE7' },
  toggleOff: { backgroundColor: '#FEE2E2' },
  toggleText: { fontSize: 13, fontWeight: '600' },

  // Content
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  personaRow: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 12, justifyContent: 'space-between',
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E', marginRight: 10 },
  personaNombre: { fontSize: 15, fontWeight: '600', color: '#111827', flex: 1 },
  chatBtn: {
    backgroundColor: '#EFF6FF', paddingHorizontal: 12,
    paddingVertical: 6, borderRadius: 16,
  },
  chatBtnText: { fontSize: 12, fontWeight: '700', color: '#3B82F6' },
  empty: { color: '#9CA3AF', fontSize: 14, textAlign: 'center', marginTop: 20 },

  // Chat screen
  chatContainer: { flex: 1, backgroundColor: '#F9FAFB' },
  chatHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  backBtn: { marginRight: 12 },
  backBtnText: { fontSize: 15, color: '#3B82F6', fontWeight: '600' },
  chatTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  mensajesScroll: { flex: 1 },
  mensajesContent: { padding: 16, gap: 8 },
  burbuja: {
    maxWidth: '75%', padding: 10,
    borderRadius: 16, marginBottom: 4,
  },
  burbujaPropia: {
    alignSelf: 'flex-end',
    backgroundColor: '#3B82F6',
    borderBottomRightRadius: 4,
  },
  burbujaAjena: {
    alignSelf: 'flex-start',
    backgroundColor: 'white',
    borderBottomLeftRadius: 4,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  burbujaTexto: { fontSize: 14, color: '#111827' },
  burbujaTextoPropio: { color: 'white' },
  burbujaHora: { fontSize: 10, color: '#9CA3AF', marginTop: 3, alignSelf: 'flex-end' },
  inputRow: {
    flexDirection: 'row', padding: 12,
    backgroundColor: 'white',
    borderTopWidth: 1, borderTopColor: '#E5E7EB',
    gap: 8,
  },
  input: {
    flex: 1, backgroundColor: '#F3F4F6',
    borderRadius: 20, paddingHorizontal: 16,
    paddingVertical: 10, fontSize: 14,
  },
  sendBtn: {
    backgroundColor: '#3B82F6', borderRadius: 20,
    paddingHorizontal: 16, justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#BFDBFE' },
  sendBtnText: { color: 'white', fontWeight: '700', fontSize: 14 },
});