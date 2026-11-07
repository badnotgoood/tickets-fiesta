import { db } from "@/lib/supabase";
import type { Role } from "@/lib/guests";

type Body = {
  pin?: string;
  action?: string;
  id?: string;
  companions?: number;
  names?: string[];
};

const FIELDS = "id, name, companions, checked_in_at";
const MAX_COMPANIONS = 50;

function roleFor(pin: string | undefined): Role | null {
  if (!pin) return null;
  if (process.env.ADMIN_PIN && pin === process.env.ADMIN_PIN) return "admin";
  if (process.env.SCANNER_PIN && pin === process.env.SCANNER_PIN) return "door";
  return null;
}

function validCompanions(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= MAX_COMPANIONS;
}

function fail(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return fail("bad_request");
  }

  const role = roleFor(body.pin);
  if (!role) return fail("unauthorized", 401);

  const guests = db().from("guests");

  switch (body.action) {
    case "login":
      return Response.json({ role });

    case "list": {
      const { data, error } = await guests.select(FIELDS).order("name");
      if (error) return fail("server", 500);
      return Response.json({ guests: data });
    }

    case "checkin": {
      if (!body.id || !validCompanions(body.companions)) return fail("bad_request");
      const { data, error } = await guests
        .update({ checked_in_at: new Date().toISOString(), companions: body.companions })
        .eq("id", body.id)
        .is("checked_in_at", null)
        .select(FIELDS);
      if (error) return fail("server", 500);
      if (data && data.length === 1) return Response.json({ guest: data[0] });

      const { data: current } = await guests.select(FIELDS).eq("id", body.id).maybeSingle();
      if (!current) return fail("not_found", 404);
      return Response.json({ guest: current, alreadyIn: true }, { status: 409 });
    }
  }

  if (role !== "admin") return fail("forbidden", 403);

  switch (body.action) {
    case "add": {
      const names = (body.names ?? [])
        .map((n) => n.replace(/\s+/g, " ").trim().toUpperCase())
        .filter(Boolean);
      if (names.length === 0) return fail("bad_request");
      const { data, error } = await guests.insert(names.map((name) => ({ name }))).select(FIELDS);
      if (error) return fail("server", 500);
      return Response.json({ guests: data });
    }

    case "remove": {
      if (!body.id) return fail("bad_request");
      const { error } = await guests.delete().eq("id", body.id);
      if (error) return fail("server", 500);
      return Response.json({ ok: true });
    }

    case "undo": {
      if (!body.id) return fail("bad_request");
      const { data, error } = await guests
        .update({ checked_in_at: null, companions: 0 })
        .eq("id", body.id)
        .select(FIELDS);
      if (error) return fail("server", 500);
      return Response.json({ guest: data?.[0] });
    }

    case "companions": {
      if (!body.id || !validCompanions(body.companions)) return fail("bad_request");
      const { data, error } = await guests
        .update({ companions: body.companions })
        .eq("id", body.id)
        .select(FIELDS);
      if (error) return fail("server", 500);
      return Response.json({ guest: data?.[0] });
    }
  }

  return fail("bad_request");
}
