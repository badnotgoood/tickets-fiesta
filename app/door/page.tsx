"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PinGate from "@/components/PinGate";
import { api, ApiError, fetchGuests, useStoredPin } from "@/lib/client";
import { formatTime, matches, stats, type Guest } from "@/lib/guests";

const PIN_KEY = "door-pin";
const REFRESH_MS = 10000;
const MAX_RESULTS = 15;

type Flash = { kind: "ok" | "warn" | "error"; title: string; detail?: string };

export default function DoorPage() {
  const [pin, setPin] = useStoredPin(PIN_KEY);

  if (pin === undefined) return null;
  if (!pin) {
    return (
      <PinGate
        title="Entrada"
        onUnlock={setPin}
      />
    );
  }
  return (
    <Door
      pin={pin}
      onLocked={() => setPin(null)}
    />
  );
}

function Door({ pin, onLocked }: { pin: string; onLocked: () => void }) {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [offline, setOffline] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Guest | null>(null);
  const [companions, setCompanions] = useState(0);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<Flash | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const { guests } = await fetchGuests(pin);
      setGuests(guests);
      setOffline(false);
      setLoaded(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) onLocked();
      else setOffline(true);
    }
  }, [pin, onLocked]);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [load]);

  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    },
    [],
  );

  const results = useMemo(() => {
    if (query.trim().length < 2) return [];
    return guests.filter((g) => matches(g.name, query)).slice(0, MAX_RESULTS);
  }, [guests, query]);

  const totals = useMemo(() => stats(guests), [guests]);

  function showFlash(next: Flash) {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setFlash(next);
    flashTimer.current = setTimeout(() => setFlash(null), 3000);
  }

  function reset() {
    setSelected(null);
    setCompanions(0);
    setQuery("");
    searchRef.current?.focus();
  }

  function replaceGuest(guest: Guest) {
    setGuests((list) => list.map((g) => (g.id === guest.id ? guest : g)));
  }

  async function checkIn() {
    if (!selected) return;
    setBusy(true);
    try {
      const { guest } = await api<{ guest: Guest }>(pin, "checkin", {
        id: selected.id,
        companions,
      });
      replaceGuest(guest);
      showFlash({
        kind: "ok",
        title: "✓ ENTRÓ",
        detail: `${guest.name}${guest.companions ? ` + ${guest.companions}` : ""}`,
      });
      reset();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const guest = err.data.guest as Guest;
        replaceGuest(guest);
        showFlash({
          kind: "warn",
          title: "YA ENTRÓ",
          detail: `${guest.name} · ${guest.checked_in_at ? formatTime(guest.checked_in_at) : ""}`,
        });
        reset();
      } else if (err instanceof ApiError && err.status === 401) {
        onLocked();
      } else if (err instanceof ApiError && err.status === 404) {
        showFlash({ kind: "error", title: "YA NO ESTÁ EN LA LISTA" });
        load();
        reset();
      } else {
        showFlash({ kind: "error", title: "SIN CONEXIÓN", detail: "Intenta de nuevo" });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="door flex min-h-dvh flex-col gap-4 p-4">
      <header className="door-header flex items-baseline justify-between">
        <h1 className="text-xl font-bold">Entrada</h1>
        <div className="text-right">
          <p className="door-count text-3xl font-extrabold">{totals.inside}</p>
          <p className="text-sm opacity-70">personas dentro</p>
        </div>
      </header>

      {offline && (
        <p className="door-offline rounded-lg bg-gray-800 p-2 text-center text-white">
          Sin conexión, reintentando…
        </p>
      )}

      {selected ? (
        <section className="door-selected flex flex-col gap-5">
          <button onClick={reset} className="self-start text-sm underline">
            ← Volver
          </button>
          <h2 className="text-3xl font-bold">{selected.name}</h2>

          {selected.checked_in_at ? (
            <div className="door-already rounded-xl bg-yellow-400 p-5 text-black">
              <p className="text-2xl font-extrabold">YA ENTRÓ</p>
              <p className="text-lg">
                {formatTime(selected.checked_in_at)}
                {selected.companions ? ` · + ${selected.companions}` : ""}
              </p>
            </div>
          ) : (
            <>
              <p className="text-lg">¿Cuántos acompañantes?</p>
              <div className="door-stepper flex items-center justify-between gap-4">
                <button
                  className="h-16 w-16 rounded-full border text-3xl disabled:opacity-30"
                  onClick={() => setCompanions((n) => Math.max(0, n - 1))}
                  disabled={companions === 0}
                >
                  −
                </button>
                <span className="text-6xl font-extrabold">{companions}</span>
                <button
                  className="h-16 w-16 rounded-full border text-3xl"
                  onClick={() => setCompanions((n) => Math.min(50, n + 1))}
                >
                  +
                </button>
              </div>
              <div className="door-quick grid grid-cols-6 gap-2">
                {[0, 1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setCompanions(n)}
                    className={`rounded-lg border p-3 text-lg ${companions === n ? "bg-foreground text-background" : ""}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <button
                onClick={checkIn}
                disabled={busy}
                className="door-confirm rounded-xl bg-green-600 p-5 text-2xl font-bold text-white disabled:opacity-50"
              >
                {busy
                  ? "Guardando…"
                  : `Entró · ${1 + companions} ${companions === 0 ? "persona" : "personas"}`}
              </button>
            </>
          )}
        </section>
      ) : (
        <section className="door-search flex flex-col gap-3">
          <input
            ref={searchRef}
            autoFocus
            className="rounded-xl border p-4 text-2xl"
            type="search"
            autoComplete="off"
            autoCorrect="off"
            placeholder="Buscar nombre…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          {!loaded && <p className="opacity-70">Cargando lista…</p>}

          {loaded && query.trim().length >= 2 && results.length === 0 && (
            <div className="door-missing rounded-xl bg-red-600 p-5 text-white">
              <p className="text-2xl font-extrabold">NO ESTÁ EN LA LISTA</p>
              <p>Prueba con otro nombre o apellido</p>
            </div>
          )}

          <ul className="door-results flex flex-col gap-2">
            {results.map((g) => (
              <li key={g.id}>
                <button
                  onClick={() => {
                    setSelected(g);
                    setCompanions(0);
                  }}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border p-4 text-left"
                >
                  <span className="text-lg font-semibold">{g.name}</span>
                  {g.checked_in_at ? (
                    <span className="shrink-0 rounded-full bg-yellow-400 px-3 py-1 text-sm text-black">
                      Ya entró{g.companions ? ` +${g.companions}` : ""}
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-gray-200 px-3 py-1 text-sm text-black">
                      Pendiente
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {flash && (
        <button
          onClick={() => setFlash(null)}
          className={`door-flash fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 p-6 text-center ${
            flash.kind === "ok"
              ? "bg-green-600 text-white"
              : flash.kind === "warn"
                ? "bg-yellow-400 text-black"
                : "bg-gray-800 text-white"
          }`}
        >
          <span className="text-5xl font-extrabold">{flash.title}</span>
          {flash.detail && <span className="text-2xl">{flash.detail}</span>}
        </button>
      )}
    </main>
  );
}
