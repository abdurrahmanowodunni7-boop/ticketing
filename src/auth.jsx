import { createContext, useContext, useState } from 'react';
import { API_URL } from './api';

const AuthContext = createContext(null);

function readStored() {
  try {
    return JSON.parse(localStorage.getItem('auth') || 'null');
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(readStored);

  function logout() {
    localStorage.removeItem('auth');
    setAuth(null);
  }

  async function submit(path, body) {
    const res = await fetch(`${API_URL}/auth/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(
        data.error === 'Invalid input'
          ? 'Please check your details. The password needs at least 8 characters.'
          : data.error || 'Something went wrong'
      );
    }
    const saved = { token: data.token, user: data.user };
    localStorage.setItem('auth', JSON.stringify(saved));
    setAuth(saved);
  }

  const value = {
    user: auth ? auth.user : null,
    token: auth ? auth.token : null,
    login: (email, password) => submit('login', { email, password }),
    signup: (name, email, password) => submit('register', { name, email, password }),
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}