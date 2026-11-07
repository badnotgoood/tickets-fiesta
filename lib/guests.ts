export type Guest = {
  id: string;
  name: string;
  companions: number;
  checked_in_at: string | null;
};

export type Role = "door" | "admin";

export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function matches(name: string, query: string): boolean {
  const target = normalize(name);
  return normalize(query)
    .split(" ")
    .filter(Boolean)
    .every((word) => target.includes(word));
}

export function stats(guests: Guest[]) {
  const arrived = guests.filter((g) => g.checked_in_at);
  return {
    listed: guests.length,
    arrived: arrived.length,
    missing: guests.length - arrived.length,
    companions: arrived.reduce((sum, g) => sum + g.companions, 0),
    inside: arrived.reduce((sum, g) => sum + 1 + g.companions, 0),
  };
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Bogota",
  });
}
