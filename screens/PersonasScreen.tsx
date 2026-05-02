import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Alert } from 'react-native';

type Persona = {
  id: string;
  nombre: string;
  correo: string;
};

export default function PersonasScreen() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [filtro, setFiltro] = useState('');
  const [errors, setErrors] = useState<{ nombre?: string; correo?: string }>({});

  const validate = () => {
    const e: { nombre?: string; correo?: string } = {};
    if (!nombre.trim()) e.nombre = 'El nombre es requerido';
    if (!correo.trim()) e.correo = 'El correo es requerido';
    else if (!/\S+@\S+\.\S+/.test(correo)) e.correo = 'Correo inválido';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const agregar = () => {
    if (!validate()) return;
    setPersonas(prev => [...prev, { id: Date.now().toString(), nombre, correo }]);
    setNombre('');
    setCorreo('');
    setErrors({});
  };

  const eliminar = (id: string) => {
    Alert.alert('Eliminar', '¿Seguro que quieres eliminar esta persona?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => setPersonas(prev => prev.filter(p => p.id !== id)) },
    ]);
  };

  const personasFiltradas = personas.filter(p =>
    p.nombre.toLowerCase().includes(filtro.toLowerCase()) ||
    p.correo.toLowerCase().includes(filtro.toLowerCase())
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Personas vinculadas</Text>

      {/* Formulario */}
      <View style={styles.form}>
        <TextInput
          style={[styles.input, errors.nombre && styles.inputError]}
          placeholder="Nombre"
          placeholderTextColor="#9CA3AF"
          value={nombre}
          onChangeText={setNombre}
        />
        {errors.nombre && <Text style={styles.errorText}>{errors.nombre}</Text>}

        <TextInput
          style={[styles.input, errors.correo && styles.inputError]}
          placeholder="Correo electrónico"
          placeholderTextColor="#9CA3AF"
          keyboardType="email-address"
          autoCapitalize="none"
          value={correo}
          onChangeText={setCorreo}
        />
        {errors.correo && <Text style={styles.errorText}>{errors.correo}</Text>}

        <TouchableOpacity style={styles.button} onPress={agregar}>
          <Text style={styles.buttonText}>Agregar persona</Text>
        </TouchableOpacity>
      </View>

      {/* Filtro */}
      <TextInput
        style={styles.filtro}
        placeholder="Buscar por nombre o correo..."
        placeholderTextColor="#9CA3AF"
        value={filtro}
        onChangeText={setFiltro}
      />

      {/* Lista */}
      <FlatList
        data={personasFiltradas}
        keyExtractor={item => item.id}
        ListEmptyComponent={<Text style={styles.empty}>No hay personas agregadas</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardInfo}>
              <Text style={styles.cardNombre}>{item.nombre}</Text>
              <Text style={styles.cardCorreo}>{item.correo}</Text>
            </View>
            <TouchableOpacity onPress={() => eliminar(item.id)} style={styles.deleteBtn}>
              <Text style={styles.deleteText}>Eliminar</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', paddingHorizontal: 20, paddingTop: 60 },
  title: { fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 20 },
  form: { backgroundColor: 'white', borderRadius: 16, padding: 16, marginBottom: 16, elevation: 2 },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    marginBottom: 4,
    marginTop: 8,
  },
  inputError: { borderColor: '#EF4444' },
  errorText: { fontSize: 12, color: '#EF4444', marginBottom: 4 },
  button: {
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonText: { color: 'white', fontWeight: '700', fontSize: 14 },
  filtro: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    marginBottom: 12,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 1,
  },
  cardInfo: { flex: 1 },
  cardNombre: { fontSize: 15, fontWeight: '600', color: '#111827' },
  cardCorreo: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  deleteBtn: { backgroundColor: '#FEE2E2', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  deleteText: { color: '#EF4444', fontWeight: '600', fontSize: 13 },
  empty: { textAlign: 'center', color: '#9CA3AF', marginTop: 40 },
});