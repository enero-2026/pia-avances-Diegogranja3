import { createContext, useContext, useState, ReactNode } from 'react';

type User = { correo: string; nombre: string };

type AuthContextType = {
  isLoggedIn: boolean;
  user: User | null;
  login: (correo: string, nombre: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const login = (correo: string, nombre: string) => setUser({ correo, nombre });
  const logout = () => setUser(null);

  return (
    <AuthContext.Provider value={{ isLoggedIn: !!user, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);