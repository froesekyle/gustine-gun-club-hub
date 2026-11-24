const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Admin-Key",
  "Content-Type": "application/json; charset=utf-8"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}

function cleanRecord(row) {
  const season = String(row.season || "").trim();
  const date = String(row.date || "").trim();
  const blind = String(row.blind || "").trim().toUpperCase();
  const species = String(row.species || "").trim();
  const harvest = Number(row.harvest);
  if (!/^\d{4}-\d{2}$/.test(season)) throw new Error("Invalid season");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Invalid date");
  if (!blind || blind.length > 20) throw new Error("Invalid blind");
  if (!species || species.length > 40) throw new Error("Invalid species");
  if (!Number.isInteger(harvest) || harvest < 0 || harvest > 500) throw new Error("Invalid harvest count");
  return { season, date, blind, species, harvest };
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/api/harvest") {
      const season = url.searchParams.get("season");
      const result = season
        ? await env.DB.prepare("SELECT season,date,blind,species,harvest FROM harvest_records WHERE season=? ORDER BY date,blind,species").bind(season).all()
        : await env.DB.prepare("SELECT season,date,blind,species,harvest FROM harvest_records ORDER BY date,blind,species").all();
      return json({ records: result.results || [] });
    }

    if (request.method === "POST" && url.pathname === "/api/harvest") {
      if (!env.ADMIN_KEY || request.headers.get("X-Admin-Key") !== env.ADMIN_KEY) {
        return json({ error: "Unauthorized" }, 401);
      }
      let body;
      try { body = await request.json(); } catch { return json({ error: "Request body must be JSON" }, 400); }
      if (!body || !Array.isArray(body.records) || body.records.length > 10000) {
        return json({ error: "Send { records: [...] } with no more than 10,000 records" }, 400);
      }
      let records;
      try { records = body.records.map(cleanRecord); }
      catch (error) { return json({ error: error.message }, 400); }
      const statements = records.map(r => env.DB.prepare(
        "INSERT INTO harvest_records (season,date,blind,species,harvest,updated_at) VALUES (?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(season,date,blind,species) DO UPDATE SET harvest=excluded.harvest,updated_at=CURRENT_TIMESTAMP"
      ).bind(r.season, r.date, r.blind, r.species, r.harvest));
      for (let i = 0; i < statements.length; i += 100) await env.DB.batch(statements.slice(i, i + 100));
      return json({ ok: true, received: records.length });
    }

    return json({ error: "Not found" }, 404);
  }
};
