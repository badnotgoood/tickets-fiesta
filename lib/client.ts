import { useCallback, useSyncExternalStore } from "react";
import type { Guest } from "@/lib/guests";

export class ApiError extends Error {
  constructor(
    public status: number,
    public data: Record<string, unknown>,
  ) {
    super(String(data.error ?? status));
  }
}

export async function api<T = Record<string, unknown>>(
  pin: string,
  action: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  const res = await fetch("/api/guests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin, action, ...payload }),
  });
  const data = await res.json().catch(() => ({ error: "server" }));
  if (!res.ok) throw new ApiError(res.status, data);
  return data as T;
}

export function fetchGuests(pin: string): Promise<{ guests: Guest[] }> {
  return api(pin, "list");
}

export function readStored(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStored(key: string, value: string | null) {
  try {
    if (value) sessionStorage.setItem(key, value);
    else sessionStorage.removeItem(key);
  } catch {}
}

const pinListeners = new Set<() => void>();

function subscribePin(listener: () => void) {
  pinListeners.add(listener);
  return () => {
    pinListeners.delete(listener);
  };
}

export function useStoredPin(key: string) {
  const pin = useSyncExternalStore(
    subscribePin,
    () => readStored(key),
    () => undefined,
  );
  const setPin = useCallback(
    (value: string | null) => {
      writeStored(key, value);
      pinListeners.forEach((listener) => listener());
    },
    [key],
  );
  return [pin, setPin] as const;
}
