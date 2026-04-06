// services/ChartService.js
import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import { registerables } from "chart.js";

// ── Palette (hex approximations of your Tailwind theme) ──
const P = {
    eco500: "#29B84A",   // hsl(145,62%,48%)  – brand green
    ocean500: "#4931C9",   // hsl(250,62%,48%)  – brand blue/purple
    teal500: "#17A3B8",   // hsl(190,62%,48%)  – teal
    alert500: "#C46417",   // hsl( 25,62%,48%)  – orange/alert
    warn500: "#6DB817",   // hsl( 85,62%,48%)  – yellow-green
    grid: "#E8ECF0",
    text: "#555F6E",
};

const chartCanvas = new ChartJSNodeCanvas({
    width: 860,
    height: 420,
    chartCallback: (ChartJS) => {
        ChartJS.register(...registerables);
    },
});

// ─────────────────────────────────────────────────────────
// LINE CHART  (temperature + humidity + soil + water)
// ─────────────────────────────────────────────────────────
export const generateChart = async (labels, datasets) => {
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
            scales: {
                // Left axis – percentages (humidity, soil, water)
                y: {
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
                },
                // Right axis – temperature (°C)
                y2: {
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
                },
                x: {
                    grid: { color: P.grid, lineWidth: 0.5 },
                    ticks: {
                        color: P.text,
                        font: { size: 9 },
                        maxRotation: 45,
                        minRotation: 30,
                        autoSkip: true,
                        maxTicksLimit: 14,
                    },
                },
            },
            elements: {
                point: { radius: 2, hoverRadius: 5, borderWidth: 2 },
                line: { tension: 0.35, borderWidth: 2 },
            },
        },
    };

    return await chartCanvas.renderToBuffer(config);
};

// ─────────────────────────────────────────────────────────
// CONVENIENCE BUILDERS  (called from PdfService)
// ─────────────────────────────────────────────────────────

/**
 * Build a full "all metrics" chart with dual axes.
 * Pass the raw data array; this function handles sampling & dataset creation.
 */
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
            yAxisID: "y2",   // ← right axis
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

    if (datasets.length === 0) return null;
    return await generateChart(labels, datasets);
};

// ─────────────────────────────────────────────────────────
// PIE / DOUGHNUT CHART  (CO₂ distribution)
// ─────────────────────────────────────────────────────────
export const generatePieChart = async (data) => {
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

    return await chartCanvas.renderToBuffer(config);
};