"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import PinGate from "@/components/PinGate";
import { api, ApiError, fetchGuests, useStoredPin } from "@/lib/client";
import { formatTime, matches, stats, type Guest } from "@/lib/guests";

const PIN_KEY = "admin-pin";
const REFRESH_MS = 15000;

type Filter = "all" | "arrived" | "missing";

export default function AdminPage() {
  const [pin, setPin] = useStoredPin(PIN_KEY);

  if (pin === undefined) return null;
  if (!pin) {
    return (
      <PinGate
        title="Administrador"
        requireAdmin
        onUnlock={setPin}
      />
    );
  }
  return (
    <Admin
      pin={pin}
      onLocked={() => setPin(null)}
    />
  );
}

function Admin({ pin, onLocked }: { pin: string; onLocked: () => void }) {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [newNames, setNewNames] = useState("");
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleError = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) onLocked();
      else setError("No se pudo guardar. Revisa la conexión.");
    },
    [onLocked],
  );

  const load = useCallback(async () => {
    try {
      const { guests } = await fetchGuests(pin);
      setGuests(guests);
      setError(null);
    } catch (err) {
      handleError(err);
    }
  }, [pin, handleError]);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [load]);

  const totals = useMemo(() => stats(guests), [guests]);

  const visible = useMemo(() => {
    return guests
      .filter((g) => (query.trim() ? matches(g.name, query) : true))
      .filter((g) =>
        filter === "arrived" ? g.checked_in_at : filter === "missing" ? !g.checked_in_at : true,
      )
      .sort((a, b) => {
        if (filter === "arrived" && a.checked_in_at && b.checked_in_at) {
          return b.checked_in_at.localeCompare(a.checked_in_at);
        }
        return a.name.localeCompare(b.name, "es");
      });
  }, [guests, query, filter]);

  function replaceGuest(guest: Guest) {
    setGuests((list) => list.map((g) => (g.id === guest.id ? guest : g)));
  }

  async function addGuests(e: FormEvent) {
    e.preventDefault();
    const names = newNames
      .split("\n")
      .map((n) => n.trim())
      .filter(Boolean);
    if (names.length === 0) return;
    setAdding(true);
    try {
      const { guests: added } = await api<{ guests: Guest[] }>(pin, "add", { names });
      setGuests((list) => [...list, ...added]);
      setNewNames("");
    } catch (err) {
      handleError(err);
    } finally {
      setAdding(false);
    }
  }

  async function run(guest: Guest, action: string, payload: Record<string, unknown> = {}) {
    setBusyId(guest.id);
    try {
      const data = await api<{ guest?: Guest }>(pin, action, { id: guest.id, ...payload });
      if (action === "remove") setGuests((list) => list.filter((g) => g.id !== guest.id));
      else if (data.guest) replaceGuest(data.guest);
    } catch (err) {
      handleError(err);
    } finally {
      setBusyId(null);
    }
  }

  function remove(guest: Guest) {
    if (window.confirm(`¿Eliminar a ${guest.name} de la lista?`)) run(guest, "remove");
  }

  function undo(guest: Guest) {
    if (window.confirm(`¿Deshacer la entrada de ${guest.name}?`)) run(guest, "undo");
  }

  return (
    <main className="admin mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-6 p-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Lista de invitados</h1>
        <button onClick={onLocked} className="text-sm underline">
          Salir
        </button>
      </header>

      <section className="admin-stats grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Personas dentro" value={totals.inside} strong />
        <Stat label="Invitados que llegaron" value={totals.arrived} />
        <Stat label="Acompañantes" value={totals.companions} />
        <Stat label="Faltan por llegar" value={`${totals.missing} / ${totals.listed}`} />
      </section>

      {error && <p className="rounded-lg bg-red-600 p-3 text-white">{error}</p>}

      <form onSubmit={addGuests} className="admin-add flex flex-col gap-2">
        <label className="font-semibold" htmlFor="new-names">
          Agregar invitados (uno por línea)
        </label>
        <textarea
          id="new-names"
          rows={3}
          className="rounded-lg border p-3"
          placeholder={"JUAN PÉREZ\nMARÍA GÓMEZ"}
          value={newNames}
          onChange={(e) => setNewNames(e.target.value)}
        />
        <button
          className="self-start rounded-lg bg-foreground px-5 py-3 text-background disabled:opacity-50"
          disabled={adding || !newNames.trim()}
        >
          {adding ? "Agregando…" : "Agregar"}
        </button>
      </form>

      <section className="admin-list flex flex-col gap-3">
        <input
          className="rounded-lg border p-3 text-lg"
          type="search"
          placeholder="Buscar…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ["all", `Todos (${totals.listed})`],
              ["arrived", `Llegaron (${totals.arrived})`],
              ["missing", `Faltan (${totals.missing})`],
            ] as const
          ).map(([value, text]) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`rounded-lg border p-2 text-sm ${filter === value ? "bg-foreground text-background" : ""}`}
            >
              {text}
            </button>
          ))}
        </div>

        <ul className="flex flex-col divide-y rounded-lg border">
          {visible.map((g) => (
            <li
              key={g.id}
              className={`flex flex-wrap items-center gap-3 p-3 ${busyId === g.id ? "opacity-50" : ""}`}
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{g.name}</p>
                <p className="text-sm opacity-70">
                  {g.checked_in_at
                    ? `Entró ${formatTime(g.checked_in_at)} · ${1 + g.companions} ${g.companions === 0 ? "persona" : "personas"}`
                    : "Pendiente"}
                </p>
              </div>

              {g.checked_in_at && (
                <div className="flex items-center gap-2">
                  <button
                    className="h-9 w-9 rounded-full border disabled:opacity-30"
                    disabled={busyId === g.id || g.companions === 0}
                    onClick={() => run(g, "companions", { companions: g.companions - 1 })}
                  >
                    −
                  </button>
                  <span className="w-10 text-center">+{g.companions}</span>
                  <button
                    className="h-9 w-9 rounded-full border disabled:opacity-30"
                    disabled={busyId === g.id}
                    onClick={() => run(g, "companions", { companions: g.companions + 1 })}
                  >
                    +
                  </button>
                  <button
                    className="rounded-lg border px-3 py-2 text-sm"
                    disabled={busyId === g.id}
                    onClick={() => undo(g)}
                  >
                    Deshacer
                  </button>
                </div>
              )}

              <button
                className="rounded-lg border border-red-600 px-3 py-2 text-sm text-red-600"
                disabled={busyId === g.id}
                onClick={() => remove(g)}
              >
                Eliminar
              </button>
            </li>
          ))}
          {visible.length === 0 && <li className="p-4 text-center opacity-70">Nadie aquí</li>}
        </ul>
      </section>
    </main>
  );
}

function Stat({ label, value, strong = false }: { label: string; value: number | string; strong?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${strong ? "bg-foreground text-background" : ""}`}>
      <p className="text-3xl font-extrabold">{value}</p>
      <p className="text-sm opacity-80">{label}</p>
    </div>
  );
}
