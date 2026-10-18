"use client"

import { createContext, useContext, useState, useEffect } from 'react';
import authConfig from '@/config/auth.config.json';
import { sha256Hex } from '@/lib/auth/sha256';

// Demo-grade auth for a static export: there is no server, so this only keeps casual visitors out.
// Passwords are stored as salted SHA-256 hashes, never in plain text. For a public deploy, set
// NEXT_PUBLIC_ANOMALYGUARD_LOGIN_USER and NEXT_PUBLIC_ANOMALYGUARD_LOGIN_SHA256 at build time
// (see README → Security model); that replaces the demo account and hides its hint on the login page.

type User = {
  id: string;
  name: string;
  username: string;
  role: 'admin'; // Only admin role is allowed
  avatar: string;
}

type Account = User & { passwordSha256: string };

type Session = { user: User; expiresAt: number };

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const SESSION_KEY = 'anomalyguard-user';
const SESSION_HOURS = 12;
const PASSWORD_SALT = 'anomalyguard:';

const envUser = process.env.NEXT_PUBLIC_ANOMALYGUARD_LOGIN_USER;
const envHash = process.env.NEXT_PUBLIC_ANOMALYGUARD_LOGIN_SHA256;

/** True while the built-in demo account (admin / admin) is active. */
export const isDemoLogin = !(envUser && envHash);

const accounts: Account[] = isDemoLogin
  ? (authConfig.users as Account[])
  : [{ id: '1', name: 'Township Ops', username: envUser!, role: 'admin', avatar: '', passwordSha256: envHash!.toLowerCase() }];

export const hashPassword = (password: string) => sha256Hex(PASSWORD_SALT + password);

function readSession(): User | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as Partial<Session>;
    const user = session.user;
    const valid =
      typeof session.expiresAt === 'number' &&
      session.expiresAt > Date.now() &&
      !!user &&
      user.role === 'admin' &&
      accounts.some(a => a.id === user.id && a.username === user.username);
    if (valid) return user;
  } catch (error) {
    console.error('Ignoring unreadable session:', error);
  }
  localStorage.removeItem(SESSION_KEY);
  return null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check for an existing, unexpired session
    const storedUser = readSession();
    if (storedUser) {
      setUser(storedUser);
      setIsAuthenticated(true);
    }
    setIsLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    setIsLoading(true);

    return new Promise<void>((resolve, reject) => {
      setTimeout(() => {
        const passwordSha256 = hashPassword(password);
        const foundUser = accounts.find(
          u => u.username === username && u.passwordSha256 === passwordSha256 && u.role === 'admin'
        );

        if (foundUser) {
          const { passwordSha256: _, ...safeUser } = foundUser;
          const session: Session = { user: safeUser, expiresAt: Date.now() + SESSION_HOURS * 3600000 };

          setUser(safeUser);
          setIsAuthenticated(true);
          localStorage.setItem(SESSION_KEY, JSON.stringify(session));
          setIsLoading(false);
          resolve();
        } else {
          setIsLoading(false);
          reject(new Error('Invalid credentials or insufficient permissions'));
        }
      }, 1000);
    });
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem(SESSION_KEY);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
