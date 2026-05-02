import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, PanResponder } from 'react-native';
import { Map, Camera, UserLocation } from '@maplibre/maplibre-react-native';
import * as Location from 'expo-location';

const PANEL_MIN = 0.45; // 45% de la pantalla
const PANEL_MAX = 0.85; // 85% de la pantalla

export default function App() {
  const [permitted, setPermitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelHeight = useRef(new Animated.Value(PANEL_MIN)).current;
  const lastHeight = useRef(PANEL_MIN);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setError('Permiso de ubicación denegado'); return; }
      setPermitted(true);
    })();
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gesture) => {
        // dy negativo = arrastra hacia arriba = panel más grande
        const delta = -gesture.dy / 800;
        const next = Math.min(PANEL_MAX, Math.max(PANEL_MIN, lastHeight.current + delta));
        panelHeight.setValue(next);
      },
      onPanResponderRelease: (_, gesture) => {
        const delta = -gesture.dy / 800;
        const next = Math.min(PANEL_MAX, Math.max(PANEL_MIN, lastHeight.current + delta));
        // Snap al más cercano
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
        <UserLocation />
        <Camera initialViewState={{ zoom: 15 }} trackUserLocation="course" />
      </Map>

      <Animated.View style={[styles.panel, { height: heightInterpolated }]}>
        {/* Handle drag */}
        <View {...panResponder.panHandlers} style={styles.handleArea}>
          <View style={styles.handle} />
          <Text style={styles.title}>Mi ubicación</Text>
          <Text style={styles.subtitle}>Arrastra para expandir</Text>
        </View>

        {/* Contenido del panel */}
        <View style={styles.content}>
          <Text style={styles.sectionTitle}>Personas vinculadas</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
});