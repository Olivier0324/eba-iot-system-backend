// services/ChartService.js
import { registerables } from "chart.js";

// ── Palette (hex approximations of your Tailwind theme) ──
const P = {
    eco500: "#29B84A",
    ocean500: "#4931C9",
    teal500: "#17A3B8",
    alert500: "#C46417",
    warn500: "#6DB817",
    grid: "#E8ECF0",
    text: "#555F6E",
};

// Lazy-load ChartJSNodeCanvas so a missing/incompatible native `canvas`
// binary (e.g. Windows build running on Vercel's Linux) doesn't crash the
// entire serverless function at import time.
let _chartCanvas = null;
let _canvasAvailable = null;

const getChartCanvas = async () => {
    if (_canvasAvailable === false) return null;
    if (_chartCanvas !== null) return _chartCanvas;

    try {
        const { ChartJSNodeCanvas } = await import("chartjs-node-canvas");
        _chartCanvas = new ChartJSNodeCanvas({
            width: 860,
            height: 420,
            chartCallback: (ChartJS) => {
                ChartJS.register(...registerables);
            },
        });
        _canvasAvailable = true;
        return _chartCanvas;
    } catch (e) {
        console.warn("⚠️  Chart generation unavailable (canvas not supported in this environment):", e.message);
        _canvasAvailable = false;
        return null;
    }
};

/** Build scales from dataset yAxisIDs so CO2-only reports still render a chart. */
const buildLineScales = (datasets) => {
    const ids = new Set(datasets.map((d) => d.yAxisID || "y"));
    const usesY = ids.has("y");
    const usesY2 = ids.has("y2");
    const usesYCo2 = ids.has("yCo2");
    const onlyCo2 = usesYCo2 && !usesY && !usesY2;

    const scales = {};

    if (usesY) {
        scales.y = {
            type: "linear",
            position: "left",
            beginAtZero: true,
            max: 100,
            grid: { color: P.grid, lineWidth: 1 },
            ticks: {
                color: P.text,
                font: { size: 10 },
                callback: (v) => `${v}%`,
            },
            title: {
                display: true,
                text: "Percentage (%)",
                color: P.text,
                font: { size: 10 },
            },
        };
    }

    if (usesY2) {
        scales.y2 = {
            type: "linear",
            position: "right",
            beginAtZero: false,
            grid: { drawOnChartArea: false },
            ticks: {
                color: P.text,
                font: { size: 10 },
                callback: (v) => `${v}°C`,
            },
            title: {
                display: true,
                text: "Temperature (°C)",
                color: P.text,
                font: { size: 10 },
            },
        };
    }

    if (usesYCo2) {
        scales.yCo2 = {
            type: "linear",
            position: onlyCo2 ? "left" : "right",
            offset: !onlyCo2,
            beginAtZero: false,
            suggestedMin: 300,
            grid: {
                color: P.grid,
                lineWidth: 1,
                drawOnChartArea: onlyCo2,
            },
            ticks: {
                color: P.text,
                font: { size: 10 },
                callback: (v) => `${Math.round(v)}`,
            },
            title: {
                display: true,
                text: "CO2 (ppm)",
                color: P.text,
                font: { size: 10 },
            },
        };
    }

    return scales;
};

// ─────────────────────────────────────────────────────────
// LINE CHART  (temperature + humidity + soil + water + CO2)
// ─────────────────────────────────────────────────────────
export const generateChart = async (labels, datasets) => {
    const canvas = await getChartCanvas();
    if (!canvas) return null;

    const lineScales = buildLineScales(datasets);
    lineScales.x = {
        grid: { color: P.grid, lineWidth: 0.5 },
        ticks: {
            color: P.text,
            font: { size: 9 },
            maxRotation: 45,
            minRotation: 30,
            autoSkip: true,
            maxTicksLimit: 14,
        },
    };

    const config = {
        type: "line",
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: { mode: "index", intersect: false },
            plugins: {
                legend: {
                    position: "top",
                    labels: {
                        font: { size: 11, family: "'Helvetica Neue', Helvetica, sans-serif" },
                        color: P.text,
                        padding: 16,
                        usePointStyle: true,
                        pointStyleWidth: 10,
                    },
                },
                tooltip: {
                    backgroundColor: "rgba(255,255,255,0.96)",
                    borderColor: "#E0E6ED",
                    borderWidth: 1,
                    titleColor: "#2D3748",
                    bodyColor: P.text,
                    padding: 10,
                    mode: "index",
                    intersect: false,
                },
            },
            scales: lineScales,
            elements: {
                point: { radius: 2, hoverRadius: 5, borderWidth: 2 },
                line: { tension: 0.35, borderWidth: 2 },
            },
        },
    };

    return await canvas.renderToBuffer(config);
};

// ─────────────────────────────────────────────────────────
// CONVENIENCE BUILDERS  (called from PdfService)
// ─────────────────────────────────────────────────────────
export const generateFullChart = async (data, metricFilter) => {
    const step = Math.max(1, Math.floor(data.length / 40));
    const sample = data.filter((_, i) => i % step === 0);

    const labels = sample.map((d) =>
        new Date(d.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
        })
    );

    const datasets = [];
    const only = metricFilter && metricFilter !== "all" ? metricFilter : null;

    if (!only || only === "temperature") {
        datasets.push({
            label: "Temperature (°C)",
            data: sample.map((d) => d.temperature ?? null),
            borderColor: P.eco500,
            backgroundColor: `${P.eco500}22`,
            fill: false,
            pointRadius: 2,
            yAxisID: "y2",
        });
    }

    if (!only || only === "humidity") {
        datasets.push({
            label: "Humidity (%)",
            data: sample.map((d) => d.humidity ?? null),
            borderColor: P.ocean500,
            backgroundColor: `${P.ocean500}22`,
            fill: false,
            pointRadius: 2,
            yAxisID: "y",
        });
    }

    if (!only || only === "soil" || only === "soil_moisture_percent") {
        const hasData = data.some((d) => (d.soil_moisture_percent ?? 0) > 0);
        if (hasData) {
            datasets.push({
                label: "Soil Moisture (%)",
                data: sample.map((d) => d.soil_moisture_percent ?? null),
                borderColor: P.alert500,
                backgroundColor: `${P.alert500}22`,
                fill: false,
                pointRadius: 2,
                yAxisID: "y",
            });
        }
    }

    if (!only || only === "water" || only === "water_level_percent") {
        const hasData = data.some((d) => (d.water_level_percent ?? 0) > 0);
        if (hasData) {
            datasets.push({
                label: "Water Level (%)",
                data: sample.map((d) => d.water_level_percent ?? null),
                borderColor: P.teal500,
                backgroundColor: `${P.teal500}22`,
                fill: false,
                pointRadius: 2,
                yAxisID: "y",
            });
        }
    }

    if (!only || only === "co2" || only === "co2_ppm") {
        const hasCo2 = data.some((d) => {
            const v = d.co2_ppm;
            return v != null && !isNaN(Number(v));
        });
        if (hasCo2) {
            datasets.push({
                label: "CO2 (ppm)",
                data: sample.map((d) => d.co2_ppm ?? null),
                borderColor: P.warn500,
                backgroundColor: `${P.warn500}22`,
                fill: false,
                pointRadius: 2,
                yAxisID: "yCo2",
            });
        }
    }

    if (datasets.length === 0) return null;
    return await generateChart(labels, datasets);
};

// ─────────────────────────────────────────────────────────
// PIE / DOUGHNUT CHART  (CO₂ distribution)
// ─────────────────────────────────────────────────────────
export const generatePieChart = async (data) => {
    const canvas = await getChartCanvas();
    if (!canvas) return null;

    const config = {
        type: "doughnut",
        data: {
            labels: data.map((d) => d.label),
            datasets: [
                {
                    data: data.map((d) => d.value),
                    backgroundColor: data.map((d) => d.color),
                    borderColor: "#FFFFFF",
                    borderWidth: 3,
                    hoverOffset: 8,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            cutout: "55%",
            plugins: {
                legend: {
                    position: "right",
                    labels: {
                        font: { size: 10, family: "'Helvetica Neue', Helvetica, sans-serif" },
                        color: P.text,
                        padding: 14,
                        usePointStyle: true,
                        pointStyleWidth: 8,
                    },
                },
                tooltip: {
                    backgroundColor: "rgba(255,255,255,0.96)",
                    borderColor: "#E0E6ED",
                    borderWidth: 1,
                    titleColor: "#2D3748",
                    bodyColor: P.text,
                    padding: 10,
                    callbacks: {
                        label: (ctx) => {
                            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                            const pct = total > 0 ? ((ctx.raw / total) * 100).toFixed(1) : 0;
                            return `  ${ctx.label}: ${ctx.raw} readings (${pct}%)`;
                        },
                    },
                },
            },
        },
    };

    return await canvas.renderToBuffer(config);
};
