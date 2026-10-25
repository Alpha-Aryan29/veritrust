"use client";

import type React from "react";
import { createContext, useContext, useEffect, useState } from "react";

export type UserRole = "REGISTRAR" | "ADMIN" | "VERIFIER" | "STUDENT";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  institution: string;
  walletAddress: string;
  actorKey?: string;
}

export const PRESET_USERS: Record<string, UserProfile> = {
  sitRegistrar: {
    id: "usr_sit_reg",
    name: "Prof. Ramesh Kulkarni",
    email: "registrar@sit.example",
    role: "REGISTRAR",
    institution: "Sahyadri Institute of Technology",
    walletAddress: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    actorKey: "sitRegistry",
  },
  ksuRegistrar: {
    id: "usr_ksu_reg",
    name: "Dr. Sarah Jenkins",
    email: "registrar@ksu.example",
    role: "REGISTRAR",
    institution: "Konkan State University",
    walletAddress: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4df",
    actorKey: "ksuRegistry",
  },
  sitAdmin: {
    id: "usr_sit_admin",
    name: "Dean Marcus Vance",
    email: "admin@sit.example",
    role: "ADMIN",
    institution: "Sahyadri Institute of Technology",
    walletAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    actorKey: "sitAdmin",
  },
  employerVerifier: {
    id: "usr_employer_ver",
    name: "Priya Sharma (HR Tech Lead)",
    email: "priya.sharma@google.com",
    role: "VERIFIER",
    institution: "Independent Background Verification",
    walletAddress: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
  },
  studentAlice: {
    id: "usr_student_alice",
    name: "Alice Johnson",
    email: "alice.johnson@student.sit.example",
    role: "STUDENT",
    institution: "SIT Graduate (B.Tech CE)",
    walletAddress: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4df",
  },
};

interface AuthContextType {
  user: UserProfile | null;
  login: (
    email: string,
    role: UserRole,
    name?: string,
    institution?: string,
  ) => void;
  logout: () => void;
  switchPreset: (presetKey: string) => void;
  isAuthOpen: boolean;
  setIsAuthOpen: (open: boolean) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  login: () => {},
  logout: () => {},
  switchPreset: () => {},
  isAuthOpen: false,
  setIsAuthOpen: () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("veritrust_user_v2");
      if (saved) {
        setUser(JSON.parse(saved));
      } else {
        setUser(PRESET_USERS.sitRegistrar);
      }
    } catch (_) {
      setUser(PRESET_USERS.sitRegistrar);
    }
  }, []);

  const login = (
    email: string,
    role: UserRole,
    name?: string,
    institution?: string,
  ) => {
    const newUser: UserProfile = {
      id: `usr_${Date.now()}`,
      name: name || email.split("@")[0],
      email,
      role,
      institution: institution || "Institutional Partner",
      walletAddress: `0x${Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`,
    };
    setUser(newUser);
    try {
      localStorage.setItem("veritrust_user_v2", JSON.stringify(newUser));
    } catch (_) {}
    setIsAuthOpen(false);
  };

  const logout = () => {
    setUser(null);
    try {
      localStorage.removeItem("veritrust_user_v2");
    } catch (_) {}
  };

  const switchPreset = (key: string) => {
    const preset = PRESET_USERS[key];
    if (preset) {
      setUser(preset);
      try {
        localStorage.setItem("veritrust_user_v2", JSON.stringify(preset));
      } catch (_) {}
    }
    setIsAuthOpen(false);
  };

  return (
    <AuthContext.Provider
      value={{ user, login, logout, switchPreset, isAuthOpen, setIsAuthOpen }}
    >
      {children}
      {isAuthOpen && <AuthModalDialog onClose={() => setIsAuthOpen(false)} />}
    </AuthContext.Provider>
  );
}

function AuthModalDialog({ onClose }: { onClose: () => void }) {
  const { user, login, switchPreset, logout } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>("REGISTRAR");
  const [institution, setInstitution] = useState(
    "Sahyadri Institute of Technology",
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    login(email, role, name, institution);
  };

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div
        className="w-full max-w-lg glass-panel-glow rounded-2xl p-6 sm:p-8 text-left relative overflow-hidden bg-[#0c101a] border border-emerald-500/30"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-gray-400 hover:text-white p-2 rounded-lg hover:bg-white/5 transition"
          aria-label="Close modal"
        >
          ✕
        </button>

        <div className="mb-6">
          <span className="text-xs font-mono font-semibold uppercase tracking-widest text-emerald-400 block mb-2">
            Institutional Access & Key Management
          </span>
          <h2 className="text-2xl font-bold tracking-tight text-white">
            {mode === "signin"
              ? "Sign In to VeriTrust"
              : "Register Institution Key"}
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Access authorized issuance, on-chain revocation, zero-trust
            verification, or student credentials.
          </p>
        </div>

        {/* Institutional Profiles */}
        <div className="mb-6 bg-white/[0.03] border border-white/10 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-emerald-400">
              Authorized Institutional Key Profiles
            </span>
          </div>
          <p className="text-xs text-gray-400 mb-3">
            Select an authorized institutional profile to test role-gated
            operations:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => switchPreset("sitRegistrar")}
              className="text-left px-3 py-2 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-600/30 text-xs transition flex flex-col"
            >
              <strong className="text-emerald-300">SIT Registrar Office</strong>
              <span className="text-gray-400 text-[10px]">
                Authorized Issuer • B.Tech
              </span>
            </button>
            <button
              type="button"
              onClick={() => switchPreset("ksuRegistrar")}
              className="text-left px-3 py-2 rounded-lg bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-600/30 text-xs transition flex flex-col"
            >
              <strong className="text-cyan-300">KSU Registrar Office</strong>
              <span className="text-gray-400 text-[10px]">
                Authorized Issuer • Konkan
              </span>
            </button>
            <button
              type="button"
              onClick={() => switchPreset("sitAdmin")}
              className="text-left px-3 py-2 rounded-lg bg-purple-950/40 hover:bg-purple-900/60 border border-purple-600/30 text-xs transition flex flex-col"
            >
              <strong className="text-purple-300">SIT Institution Admin</strong>
              <span className="text-gray-400 text-[10px]">
                Governance • Key Management
              </span>
            </button>
            <button
              type="button"
              onClick={() => switchPreset("employerVerifier")}
              className="text-left px-3 py-2 rounded-lg bg-blue-950/40 hover:bg-blue-900/60 border border-blue-600/30 text-xs transition flex flex-col"
            >
              <strong className="text-blue-300">Independent Verifier</strong>
              <span className="text-gray-400 text-[10px]">
                Public Trustless Auditor
              </span>
            </button>
            <button
              type="button"
              onClick={() => switchPreset("studentAlice")}
              className="col-span-1 sm:col-span-2 text-left px-3 py-2 rounded-lg bg-amber-950/30 hover:bg-amber-900/50 border border-amber-600/30 text-xs transition flex items-center justify-between"
            >
              <div>
                <strong className="text-amber-300">
                  Alice Johnson (Student)
                </strong>
                <span className="text-gray-400 text-[10px] block">
                  B.Tech Graduate • Credential Holder
                </span>
              </div>
              <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded">
                View Diploma
              </span>
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="relative flex py-2 items-center mb-4">
          <div className="flex-grow border-t border-white/10"></div>
          <span className="flex-shrink mx-3 text-[11px] font-mono uppercase text-gray-500">
            Or Custom Account
          </span>
          <div className="flex-grow border-t border-white/10"></div>
        </div>

        {/* Custom Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === "signup" && (
            <div>
              <label className="block text-xs font-mono text-gray-300 uppercase mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Dr. Rajesh Sharma"
                className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white text-sm focus:border-emerald-500 focus:outline-none"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-mono text-gray-300 uppercase mb-1">
              Institutional Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="registrar@vjti.ac.in"
              className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white text-sm focus:border-emerald-500 focus:outline-none"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-mono text-gray-300 uppercase mb-1">
                Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full px-3 py-2 rounded-lg bg-[#141a29] border border-white/10 text-white text-sm focus:border-emerald-500 focus:outline-none"
              >
                <option value="REGISTRAR">University Registrar</option>
                <option value="ADMIN">Institution Admin</option>
                <option value="VERIFIER">Public Verifier</option>
                <option value="STUDENT">Graduate Student</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-mono text-gray-300 uppercase mb-1">
                Institution
              </label>
              <input
                type="text"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                placeholder="SIT Demo Registry"
                className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="text-xs text-gray-400 hover:text-emerald-400 transition"
            >
              {mode === "signin"
                ? "Don't have an account? Sign Up"
                : "Already have credentials? Sign In"}
            </button>

            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-semibold text-sm transition shadow-lg shadow-emerald-500/20"
            >
              {mode === "signin" ? "Sign In" : "Create Keypair"}
            </button>
          </div>
        </form>

        {user && (
          <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-gray-400">
            <span>
              Currently logged in:{" "}
              <strong className="text-white">{user.name}</strong> ({user.role})
            </span>
            <button
              onClick={logout}
              className="text-red-400 hover:text-red-300 font-mono text-xs underline"
            >
              Sign Out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
