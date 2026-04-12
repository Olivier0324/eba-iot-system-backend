/**
 * Normalize MQTT / API sensor payloads onto the canonical SensorData field names
 * and real JavaScript numbers (avoids string math bugs in PDF stats).
 */
export function coerceNumber(v) {
    if (v == null || v === "") return null;
    if (typeof v === "object" && v !== null && typeof v.toString === "function") {
        const n = Number(v.toString());
        return Number.isFinite(n) ? n : null;
    }
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

export function normalizeSensorRecord(raw) {
    const o = raw && typeof raw.toObject === "function" ? raw.toObject() : { ...raw };
    return {
        ...o,
        temperature: coerceNumber(o.temperature),
        humidity: coerceNumber(o.humidity),
        co2_ppm: coerceNumber(o.co2_ppm ?? o.co2 ?? o.CO2),
        soil_moisture_percent: coerceNumber(
            o.soil_moisture_percent ?? o.soil_moisture ?? o.soilMoisture
        ),
        water_level_percent: coerceNumber(
            o.water_level_percent ?? o.water_level ?? o.waterLevel
        ),
        interval_ms: coerceNumber(o.interval_ms),
        timestamp: o.timestamp ? new Date(o.timestamp) : null,
    };
}

/** Drop consecutive identical readings (duplicate MQTT / DB inserts). */
export function dedupeSensorReadings(readings) {
    const sorted = [...readings].sort(
        (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    );
    const out = [];
    let prevSig = null;
    for (const r of sorted) {
        const ts = r.timestamp instanceof Date ? r.timestamp.getTime() : new Date(r.timestamp).getTime();
        const sig = `${ts}_${r.temperature}_${r.humidity}_${r.co2_ppm}_${r.soil_moisture_percent}_${r.water_level_percent}`;
        if (sig === prevSig) continue;
        prevSig = sig;
        out.push(r);
    }
    return out;
}
