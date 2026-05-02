import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, PanResponder, TouchableOpacity } from 'react-native';
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

export default function HomeScreen() {
  const { user } = useAuth();
  const [permitted, setPermitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [personas, setPersonas] = useState<PersonaUbicacion[]>([]);
  const [compartiendo, setCompartiendo] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);
  const compartidiendoRef = useRef(true);
  const panelHeight = useRef(new Animated.Value(PANEL_MIN)).current;
  const lastHeight = useRef(PANEL_MIN);

  // Sincronizar ref con estado para usarlo dentro del interval
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

  useEffect(() => {
    if (!permitted || !user) return;

    const ws = new WebSocket(`${WS_URL}/ws/${user.correo}`);
    wsRef.current = ws;

    ws.onopen = () => {
      const interval = setInterval(async () => {
        if (!compartidiendoRef.current) return;
        const loc = await Location.getCurrentPositionAsync({});
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
          }));
        }
      }, 4000);

      ws.onclose = () => clearInterval(interval);
    };

    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      setPersonas(prev => {
        const existe = prev.find(p => p.correo === data.correo);
        if (existe) return prev.map(p => p.correo === data.correo ? data : p);
        return [...prev, data];
      });
    };

    ws.onerror = (e) => console.log('WS error:', e);

    return () => ws.close();
  }, [permitted, user]);

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

  if (error) return <View style={styles.center}><Text>{error}</Text></View>;
  if (!permitted) return <View style={styles.center}><Text>Obteniendo ubicación...</Text></View>;

  return (
    <View style={styles.container}>
      <Map
        style={styles.map}
        mapStyle="https://tiles.openfreemap.org/styles/liberty"
      >
        {compartiendo && <UserLocation />}
        <Camera initialViewState={{ zoom: 15 }} trackUserLocation="course" />

{personas.map(p => (
  <Marker
    key={p.correo}
    lngLat={[p.lng, p.lat]}
  >
    <View style={styles.marker}>
      <Text style={styles.markerText}>{p.correo.split('@')[0]}</Text>
    </View>
  </Marker>
))}
      </Map>

      <Animated.View style={[styles.panel, { height: heightInterpolated }]}>
        <View {...panResponder.panHandlers} style={styles.handleArea}>
          <View style={styles.handle} />
          <Text style={styles.title}>Mi ubicación</Text>
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
          {personas.map(p => (
            <View key={p.correo} style={styles.personaRow}>
              <View style={styles.dot} />
              <Text style={styles.personaNombre}>{p.correo.split('@')[0]}</Text>
            </View>
          ))}
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
  marker: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'white',
  },
  markerText: { color: 'white', fontSize: 11, fontWeight: '700' },
  panel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 16,
  },
  handleArea: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
    paddingHorizontal: 20,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    marginBottom: 12,
  },
  title: { fontSize: 18, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  toggleBtn: {
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'center',
  },
  toggleOn: { backgroundColor: '#DCFCE7' },
  toggleOff: { backgroundColor: '#FEE2E2' },
  toggleText: { fontSize: 13, fontWeight: '600' },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  personaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E', marginRight: 10 },
  personaNombre: { fontSize: 15, fontWeight: '600', color: '#111827' },
  empty: { color: '#9CA3AF', fontSize: 14, textAlign: 'center', marginTop: 20 },
});