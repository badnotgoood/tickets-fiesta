"use client";

import { useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/client";
import type { Role } from "@/lib/guests";

type Props = {
  title: string;
  requireAdmin?: boolean;
  onUnlock: (pin: string) => void;
};

export default function PinGate({ title, requireAdmin = false, onUnlock }: Props) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { role } = await api<{ role: Role }>(value, "login");
      if (requireAdmin && role !== "admin") setError("PIN incorrecto");
      else onUnlock(value);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? "PIN incorrecto" : "Sin conexión");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="pin-page flex min-h-dvh flex-col items-center justify-center gap-4 p-6">
      <h1 className="text-2xl font-bold">{title}</h1>
      <form onSubmit={submit} className="flex w-full max-w-xs flex-col gap-3">
        <input
          className="rounded-lg border p-3 text-center text-2xl tracking-widest"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          placeholder="PIN"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <button
          className="rounded-lg bg-foreground p-3 text-lg text-background disabled:opacity-50"
          disabled={busy || !value}
        >
          {busy ? "Verificando…" : "Entrar"}
        </button>
        {error && <p className="text-center text-red-600">{error}</p>}
      </form>
    </main>
  );
}
