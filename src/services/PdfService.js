// services/PdfService.js
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { generateFullChart, generatePieChart } from "./ChartService.js";

// HELPERS

/**
 * Strip records that have no sensor readings at all
 * (device heartbeats with only device_id / interval_ms).
 */
const cleanData = (data) =>
    data.filter(
        (d) =>
            d.temperature != null ||
            d.humidity != null ||
            d.co2_ppm != null
    );

const calculateStats = (values) => {
    const valid = values.filter((v) => v != null && !isNaN(v));
    if (valid.length === 0) return { min: "--", max: "--", avg: "--", stdDev: "--", count: 0 };
    const sum = valid.reduce((a, b) => a + b, 0);
    const avg = sum / valid.length;
    const vari = valid.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / valid.length;
    return {
        min: Math.min(...valid).toFixed(1),
        max: Math.max(...valid).toFixed(1),
        avg: avg.toFixed(1),
        stdDev: Math.sqrt(vari).toFixed(1),
        count: valid.length,
    };
};

const generateAnalysisText = (metrics, selectedMetric) => {
    if (selectedMetric && selectedMetric !== "all") {
        const m = metrics.find(
            (x) => x.key === selectedMetric || x.key === selectedMetric + "_ppm" || x.key === selectedMetric + "_percent"
        );
        if (m && m.stats.count > 0) {
            const s = m.stats;
            let text = `This section provides statistical analysis of ${m.name}. `;
            text += `Over ${s.count} valid readings, values ranged from ${s.min} to ${s.max} ${m.unit}, `;
            text += `with a mean of ${s.avg} ${m.unit} and a standard deviation of ${s.stdDev} ${m.unit}. `;
            if (m.key === "co2_ppm") {
                const avg = parseFloat(s.avg);
                if (avg > 1000) text += "CO2 levels exceed recommended thresholds — immediate ventilation is required.";
                else if (avg > 800) text += "CO2 levels are elevated. Increasing ventilation frequency is advised.";
                else text += "CO2 levels remain within acceptable limits.";
            }
            return text;
        }
    }

    let text = "This section summarises statistical analysis across all monitored environmental parameters. ";
    for (const m of metrics) {
        if (m.stats.count === 0) continue;
        const s = m.stats;
        text += `${m.name} ranged from ${s.min} to ${s.max} ${m.unit} (avg ${s.avg} ${m.unit}, SD ${s.stdDev}). `;
    }
    return text;
};

const generateRecommendations = (metrics, data, selectedMetric) => {
    const recs = [];
    if (!data || data.length === 0) return "No data available for recommendations.";

    const valid = cleanData(data);
    const avgTemp = valid.length ? valid.reduce((s, d) => s + (d.temperature || 0), 0) / valid.length : 0;
    const avgHum = valid.length ? valid.reduce((s, d) => s + (d.humidity || 0), 0) / valid.length : 0;
    const avgCO2 = valid.length ? valid.reduce((s, d) => s + (d.co2_ppm || 0), 0) / valid.length : 0;
    const avgSoil = valid.length ? valid.reduce((s, d) => s + (d.soil_moisture_percent || 0), 0) / valid.length : 0;
    const avgWater = valid.length ? valid.reduce((s, d) => s + (d.water_level_percent || 0), 0) / valid.length : 0;

    const show = (key) =>
        !selectedMetric || selectedMetric === "all" || selectedMetric === key || selectedMetric === key + "_ppm" || selectedMetric === key + "_percent";

    if (show("temperature")) {
        if (avgTemp > 28) recs.push("• Temperature is above 28°C average. Review cooling systems and shading strategies.");
        else if (avgTemp < 18) recs.push("• Temperature is below 18°C average. Evaluate heating or improved insulation.");
        else recs.push("• Temperature is within the optimal 18-28°C range. Continue regular monitoring.");
    }

    if (show("humidity")) {
        if (avgHum > 75) recs.push("• Humidity exceeds 75% average — risk of mould growth. Improve airflow and dehumidification.");
        else if (avgHum < 30) recs.push("• Low humidity detected (< 30%). Consider humidification to improve plant and occupant comfort.");
        else recs.push("• Humidity levels are within the recommended 30-75% range.");
    }

    if (show("co2")) {
        if (avgCO2 > 1000) recs.push("• CRITICAL: CO2 exceeds 1000 ppm. Implement immediate ventilation protocols.");
        else if (avgCO2 > 800) recs.push("• CO2 is moderately elevated (800-1000 ppm). Scheduled ventilation is recommended.");
        else recs.push("• CO2 levels are within acceptable limits (< 800 ppm).");
    }

    if (show("soil")) {
        const hasSoilData = valid.some((d) => (d.soil_moisture_percent ?? 0) > 0);
        if (hasSoilData) {
            if (avgSoil < 20) recs.push("• Soil moisture is critically low. Review irrigation scheduling.");
            else if (avgSoil > 80) recs.push("• Soil moisture is very high. Reduce watering frequency to prevent root issues.");
            else recs.push("• Soil moisture levels are within the healthy 20-80% range.");
        } else {
            recs.push("• Soil moisture sensor returned no data this period. Verify sensor connectivity.");
        }
    }

    if (show("water")) {
        const hasWaterData = valid.some((d) => (d.water_level_percent ?? 0) > 0);
        if (hasWaterData) {
            if (avgWater < 20) recs.push("• Water level is critically low (< 20%). Refill reservoir promptly.");
            else if (avgWater > 90) recs.push("• Water level is near capacity. Verify overflow prevention systems.");
            else recs.push("• Water levels are within normal operating range.");
        } else {
            recs.push("• Water level sensor returned no data this period. Verify sensor connectivity.");
        }
    }

    if (recs.length === 0)
        recs.push("• All monitored parameters are within acceptable ranges. Continue regular monitoring.");

    return "Based on collected data, the following actions are recommended:\n\n" + recs.join("\n");
};


export const generatePDF = async (rawData, options) => {
    if (!rawData || !Array.isArray(rawData) || rawData.length === 0)
        throw new Error("Invalid or empty data provided for PDF generation");

    const { metric, type } = options || {};
    const data = cleanData(rawData);
    if (data.length === 0)
        throw new Error("No records with sensor readings found after filtering");

    const reportsDir = process.env.VERCEL
        ? "/tmp/reports"
        : path.join(process.cwd(), "reports");
    if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

    const fileName = `report_${Date.now()}.pdf`;
    const filePath = path.join(reportsDir, fileName);

    const doc = new PDFDocument({ margin: 50, size: "A4", autoFirstPage: true });
    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);


    const C = {
        // eco greens
        primary: "#29B84A",   
        primaryDark: "#1E7D33",   
        primaryDeep: "#145222",  

        // ocean blues
        ocean: "#4931C9",   
        oceanDark: "#312188",   

        // teal
        teal: "#17A3B8",  

        // alert / semantic
        warning: "#DC3545",  
        alert: "#C46417",   
        warnGreen: "#6DB817", 
        info: "#0D6EFD", 

        // neutrals
        text: "#2D3748",
        textLight: "#718096",
        textMuted: "#A0AEC0",
        border: "#E2E8F0",
        borderLight: "#EDF2F7",
        borderDark: "#CBD5E0",
        background: "#F7FAFC",
        cardBg: "#FFFFFF",
        stripeBg: "#F0FFF4",  
        white: "#FFFFFF",

        // chart colours
        chart1: "#29B84A",   
        chart2: "#4931C9", 
        chart3: "#17A3B8",   
        chart4: "#C46417",   
        chart5: "#6DB817", 
    };

    const T = {
        h1: { size: 18, font: "Helvetica-Bold" },
        h2: { size: 14, font: "Helvetica-Bold" },
        h3: { size: 11, font: "Helvetica-Bold" },
        body: { size: 9, font: "Helvetica" },
        small: { size: 7.5, font: "Helvetica" },
        caption: { size: 7, font: "Helvetica-Oblique" },
        mono: { size: 6, font: "Courier" },
    };

    // ── Page geometry ──────────────────────────────────────────
    const PAGE_W = doc.page.width;
    const PAGE_H = doc.page.height;
    const MARGIN = 50;
    const CONTENT_W = PAGE_W - MARGIN * 2;
    const PAGE_TOP = MARGIN;
    const PAGE_BOTTOM = PAGE_H - 58;   // leave 58 pt for footer

    let pageNumber = 1;
    let currentY = PAGE_TOP;
    let hasContentOnCurrentPage = false;

    // ── Footer ─────────────────────────────────────────────────
    const addFooter = () => {
        if (!hasContentOnCurrentPage) return;
        doc.save();

        const savedBottom = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;

        const fy = PAGE_H - 44;
        doc.strokeColor(C.primary).lineWidth(1.5)
            .moveTo(MARGIN, fy)
            .lineTo(PAGE_W - MARGIN, fy)
            .stroke();

        // Left: system name
        doc.fillColor(C.primaryDark).fontSize(T.small.size).font("Helvetica-Bold")
            .text("ECOBASED SYSTEM", MARGIN, fy + 8);

        // Centre: confidential tag
        doc.fillColor(C.textMuted).fontSize(T.small.size).font(T.small.font)
            .text(
                `Confidential  |  Generated: ${new Date().toLocaleDateString()}`,
                MARGIN, fy + 8,
                { align: "center", width: CONTENT_W }
            );

        // Right: page number
        doc.fillColor(C.primaryDark).fontSize(T.small.size).font("Helvetica-Bold")
            .text(`Page ${pageNumber}`, MARGIN, fy + 8, { align: "right", width: CONTENT_W });

        doc.page.margins.bottom = savedBottom;
        doc.restore();
    };
    const newPage = () => {
        addFooter();
        doc.addPage();
        pageNumber++;
        currentY = PAGE_TOP;
        hasContentOnCurrentPage = false;
    };

    const ensureSpace = (needed) => {
        if (currentY + needed > PAGE_BOTTOM) newPage();
    };

    const HEADING_H = 36;
    const FRESH_PAGE_THRESHOLD = 80;

    const sectionHeading = (label, icon = "", minContent = 100) => {
        const fresh = currentY <= PAGE_TOP + FRESH_PAGE_THRESHOLD;
        const overflow = currentY + HEADING_H + minContent > PAGE_BOTTOM;
        if (!fresh && overflow) newPage();

        // Accent bar + title (extra vertical room reads better in PDF viewers)
        doc.rect(MARGIN, currentY, 4, 26).fill(C.primary);

        doc.fillColor(C.primaryDark)
            .fontSize(T.h2.size)
            .font(T.h2.font)
            .text(`${icon}  ${label}`.trim(), MARGIN + 14, currentY + 5);

        currentY += 28;
        doc.strokeColor(C.borderLight).lineWidth(0.75)
            .moveTo(MARGIN + 10, currentY)
            .lineTo(MARGIN + CONTENT_W, currentY)
            .stroke();
        currentY += 8;
        hasContentOnCurrentPage = true;
    };

    const renderText = (text, opts = {}) => {
        const {
            width = CONTENT_W,
            align = "left",
            fontSize = T.body.size,
            font = T.body.font,
            color = C.text,
            marginBottom = 10,
            x = MARGIN,
        } = opts;

        doc.fontSize(fontSize).font(font).fillColor(color);
        const h = doc.heightOfString(text, { width, align });
        ensureSpace(h + marginBottom);
        doc.text(text, x, currentY, { width, align });
        currentY += h + marginBottom;
        hasContentOnCurrentPage = true;
    };
    const rule = (topMargin = 8, bottomMargin = 8) => {
        currentY += topMargin;
        doc.strokeColor(C.border).lineWidth(0.5)
            .moveTo(MARGIN, currentY)
            .lineTo(MARGIN + CONTENT_W, currentY)
            .stroke();
        currentY += bottomMargin;
    };
    const HEADER_H = 104;
    doc.rect(0, 0, PAGE_W, HEADER_H).fill(C.primaryDeep);
    doc.rect(0, HEADER_H - 2, PAGE_W, 3).fill(C.primary);

    // Wide EBA OBSERVA mark: place on a soft white plate so dark glyphs remain readable on the dark header.
    const LOGO_FIT = [170, 52];
    const LOGO_X = MARGIN;
    const LOGO_Y = 18;
    const TITLE_X = LOGO_X + LOGO_FIT[0] + 14;
    const logoPath = path.join(process.cwd(), "assets", "logo-report-transparent.png");
    if (fs.existsSync(logoPath)) {
        try {
            doc.roundedRect(LOGO_X - 6, LOGO_Y - 4, LOGO_FIT[0] + 12, LOGO_FIT[1] + 8, 8).fillOpacity(0.96).fill(C.white);
            doc.fillOpacity(1);
            doc.image(logoPath, LOGO_X, LOGO_Y, { fit: LOGO_FIT });
        } catch {
            doc.circle(MARGIN + 22, 43, 22).fill(C.primary);
        }
    } else {
        // Minimal leaf icon placeholder
        doc.roundedRect(MARGIN, 18, 46, 50, 8).fill(C.primary);
        doc.fillColor(C.white).fontSize(22).font("Helvetica-Bold")
            .text("E", MARGIN + 14, 31);
    }

    const headerTitle = "ENVIRONMENTAL MONITORING REPORT";
    const titleWidth = PAGE_W - TITLE_X - MARGIN;
    doc.fillColor(C.white).fontSize(16).font(T.h1.font);
    const titleH = doc.heightOfString(headerTitle, { width: titleWidth, align: "left" });
    doc.text(headerTitle, TITLE_X, 20, { width: titleWidth, align: "left" });

    const metaY = 20 + titleH + 3;
    doc.fillColor(`${C.white}D9`).fontSize(10).font("Helvetica-Bold")
        .text(`Report Type: ${(type || "CUSTOM").toUpperCase()}  |  Generated: ${new Date().toLocaleString()}`, TITLE_X, metaY, {
            width: titleWidth,
        });

    // Metric badge if filtered
    if (metric && metric !== "all") {
        const badge = metric.replace("_ppm", "").replace("_percent", "").toUpperCase();
        const badgeY = Math.min(metaY + 15, HEADER_H - 18);
        doc.roundedRect(TITLE_X, badgeY, badge.length * 7 + 16, 16, 4).fill(C.primary);
        doc.fillColor(C.white).fontSize(8).font("Helvetica-Bold")
            .text(`METRIC: ${badge}`, TITLE_X + 8, badgeY + 4);
    }

    hasContentOnCurrentPage = true;
    currentY = HEADER_H + 14;

    // ─────────────────────────────────────────────────────────
    // PRE-COMPUTE STATS
    // ─────────────────────────────────────────────────────────
    const metricDefs = [
        { name: "Temperature", key: "temperature", unit: "°C", color: C.chart1 },
        { name: "Humidity", key: "humidity", unit: "%", color: C.chart2 },
        { name: "CO2", key: "co2_ppm", unit: "ppm", color: C.chart3 },
        { name: "Soil Moisture", key: "soil_moisture_percent", unit: "%", color: C.chart4 },
        { name: "Water Level", key: "water_level_percent", unit: "%", color: C.chart5 },
    ].map((m) => ({
        ...m,
        data: data.map((d) => d[m.key]).filter((v) => v != null && !isNaN(v)),
        stats: calculateStats(data.map((d) => d[m.key]).filter((v) => v != null && !isNaN(v))),
    }));

    const getMetricStats = (key) => metricDefs.find((m) => m.key === key)?.stats;

    const dateRange = `${new Date(data[0].timestamp).toLocaleDateString()} - ${new Date(data[data.length - 1].timestamp).toLocaleDateString()}`;
    const tempStats = getMetricStats("temperature");
    const humStats = getMetricStats("humidity");
    const co2Stats = getMetricStats("co2_ppm");
    const soilStats = getMetricStats("soil_moisture_percent");
    const waterStats = getMetricStats("water_level_percent");

    // ─────────────────────────────────────────────────────────
    // 1. EXECUTIVE SUMMARY
    // ─────────────────────────────────────────────────────────
    sectionHeading("1. Executive Summary");

    let summaryText =
        `This report presents environmental monitoring data collected by the EBA System ` +
        `over the period ${dateRange}. ` +
        `A total of ${rawData.length} records were retrieved; ` +
        `${data.length} contained valid sensor readings (${rawData.length - data.length} heartbeat-only records excluded). `;

    if (!metric || metric === "all" || metric === "temperature")
        summaryText += `Average temperature was ${tempStats?.avg ?? "--"}°C (range: ${tempStats?.min ?? "--"} - ${tempStats?.max ?? "--"}°C). `;
    if (!metric || metric === "all" || metric === "humidity")
        summaryText += `Relative humidity averaged ${humStats?.avg ?? "--"}%. `;
    if (!metric || metric === "all" || metric === "co2" || metric === "co2_ppm") {
        const avgCO2n = parseFloat(co2Stats?.avg ?? 0);
        summaryText += `CO2 averaged ${co2Stats?.avg ?? "--"} ppm. `;
        if (avgCO2n > 1000) summaryText += "CO2 levels exceeded safe thresholds, requiring immediate ventilation. ";
    }
    if ((!metric || metric === "all" || metric === "soil") && soilStats?.count > 0 && soilStats.avg !== "--")
        summaryText += `Soil moisture averaged ${soilStats.avg}%. `;
    if ((!metric || metric === "all" || metric === "water") && waterStats?.count > 0 && waterStats.avg !== "--")
        summaryText += `Water level averaged ${waterStats.avg}%. `;

    renderText(summaryText, { align: "justify", marginBottom: 14 });

    // ── KPI summary cards (2-column grid) ─────────────────────
    const kpiMetrics = metricDefs.filter((m) => {
        if (metric && metric !== "all") {
            return m.key === metric || m.key === metric + "_ppm" || m.key === metric + "_percent";
        }
        return true;
    }).filter((m) => m.stats.count > 0);

    const KPI_H = 56;
    const KPI_W = (CONTENT_W - 10) / 2;
    const KPI_GAP = 10;

    let col = 0;
    let rowStartY = currentY;

    ensureSpace(KPI_H + 12);
    rowStartY = currentY;

    for (const m of kpiMetrics) {
        const x = MARGIN + col * (KPI_W + KPI_GAP);

        doc.roundedRect(x, currentY, KPI_W, KPI_H, 6)
            .fill(C.cardBg)
            .stroke(C.border);

        // Left colour strip
        doc.rect(x, currentY, 5, KPI_H).fill(m.color);

        doc.fillColor(m.color).fontSize(8.5).font("Helvetica-Bold")
            .text(m.name.toUpperCase(), x + 14, currentY + 10, { width: KPI_W - 20 });

        // One line for value + unit avoids PDFKit widthOfString/font mismatch (was overlapping the decimal).
        let valueLine;
        if (m.unit === "ppm") valueLine = `${m.stats.avg} ppm`;
        else if (m.unit === "%") valueLine = `${m.stats.avg}%`;
        else valueLine = `${m.stats.avg} ${m.unit}`;

        doc.fillColor(C.text).fontSize(16).font("Helvetica-Bold")
            .text(valueLine, x + 14, currentY + 22, { width: KPI_W - 20, ellipsis: true });

        // ASCII-only: standard PDF fonts often substitute arrows and middle dots with wrong glyphs.
        doc.fillColor(C.textMuted).fontSize(8).font("Helvetica")
            .text(`Min ${m.stats.min}  /  Max ${m.stats.max}`, x + 14, currentY + 40, { width: KPI_W - 20 });

        col++;
        if (col === 2) {
            col = 0;
            currentY += KPI_H + KPI_GAP;
            if (kpiMetrics.indexOf(m) < kpiMetrics.length - 1) {
                ensureSpace(KPI_H + KPI_GAP);
                rowStartY = currentY;
            }
        }
        hasContentOnCurrentPage = true;
    }
    if (col !== 0) currentY += KPI_H + KPI_GAP;
    currentY += 6;

    // ── Data overview bar (stacked lines so long ranges are not clipped on one row)
    const PILL_H = 44;
    ensureSpace(PILL_H + 10);
    doc.roundedRect(MARGIN, currentY, CONTENT_W, PILL_H, 8).fill(C.stripeBg).stroke(C.border);

    const paramLabel = (() => {
        if (!metric || metric === "all") return "Temperature | Humidity | CO2 | Soil | Water";
        const map = {
            temperature: "Temperature",
            humidity: "Humidity",
            co2: "CO2",
            co2_ppm: "CO2",
            soil: "Soil moisture",
            soil_moisture_percent: "Soil moisture",
            water: "Water level",
            water_level_percent: "Water level",
        };
        return map[metric] || metric.replace("_ppm", "").replace("_percent", "");
    })();

    doc.fillColor(C.primaryDark).fontSize(8.5).font("Helvetica-Bold")
        .text(`Records: ${data.length}`, MARGIN + 14, currentY + 9);
    doc.fillColor(C.textLight).fontSize(8).font("Helvetica")
        .text(`Date range: ${dateRange}`, MARGIN + 14, currentY + 21, { width: CONTENT_W - 28, ellipsis: true });
    doc.fillColor(C.textLight).fontSize(8).font("Helvetica")
        .text(`Parameters: ${paramLabel}`, MARGIN + 14, currentY + 31, { width: CONTENT_W - 28, ellipsis: true });

    currentY += PILL_H + 12;
    hasContentOnCurrentPage = true;

    // ─────────────────────────────────────────────────────────
    // 2. DETAILED SENSOR DATA TABLE
    // ─────────────────────────────────────────────────────────
    sectionHeading("2. Detailed Sensor Data", "", 80);

    const allCols = [
        { key: "timestamp", label: "Timestamp", baseW: 120 },
        {
            key: "temperature", label: "Temp (°C)", baseW: 72,
            show: !metric || metric === "temperature" || metric === "all"
        },
        {
            key: "humidity", label: "Humidity (%)", baseW: 72,
            show: !metric || metric === "humidity" || metric === "all"
        },
        {
            key: "co2_ppm", label: "CO2 (ppm)", baseW: 72,
            show: !metric || metric === "co2" || metric === "co2_ppm" || metric === "all"
        },
        {
            key: "soil_moisture_percent", label: "Soil (%)", baseW: 68,
            show: !metric || metric === "soil" || metric === "all"
        },
        {
            key: "water_level_percent", label: "Water (%)", baseW: 68,
            show: !metric || metric === "water" || metric === "all"
        },
        {
            key: "interval_ms", label: "Interval", baseW: 56,
            show: !metric || metric === "all"
        },
    ];

    const visCols = allCols.filter((c) => c.key === "timestamp" || c.show);
    const totalBase = visCols.reduce((s, c) => s + c.baseW, 0);
    let xCur = MARGIN;
    visCols.forEach((c) => {
        c.w = Math.round((c.baseW / totalBase) * CONTENT_W);
        c.x = xCur;
        xCur += c.w;
    });

    const ROW_H = 20;
    const HEAD_H = 26;
    const PAD = 4;

    const drawTableHeader = () => {
        doc.rect(MARGIN, currentY, CONTENT_W, HEAD_H).fill(C.primaryDark);
        visCols.forEach((col) => {
            doc.fillColor(C.white).fontSize(8).font("Helvetica-Bold")
                .text(col.label, col.x + PAD, currentY + 8,
                    { width: col.w - PAD * 2, ellipsis: true });
        });
        currentY += HEAD_H;
        hasContentOnCurrentPage = true;
    };

    ensureSpace(HEAD_H + ROW_H);
    drawTableHeader();

    for (let i = 0; i < data.length; i++) {
        if (currentY + ROW_H > PAGE_BOTTOM) {
            newPage();
            drawTableHeader();
        }

        // Alternating row background
        if (i % 2 === 0) doc.rect(MARGIN, currentY, CONTENT_W, ROW_H).fill(C.stripeBg);

        const rec = data[i];
        visCols.forEach((col) => {
            let display = "";
            let color = C.text;
            const val = rec[col.key];

            switch (col.key) {
                case "timestamp":
                    display = new Date(val).toLocaleString();
                    break;
                case "temperature":
                    display = val != null ? `${val.toFixed(1)}°C` : "--";
                    color = val > 30 ? C.warning : val < 15 ? C.info : C.primaryDark;
                    break;
                case "humidity":
                    display = val != null ? `${val.toFixed(1)}%` : "--";
                    color = val > 75 ? C.alert : C.text;
                    break;
                case "co2_ppm":
                    display = val != null ? `${Math.round(val)}` : "--";
                    color = val > 1000 ? C.warning : val > 800 ? C.alert : C.text;
                    break;
                case "soil_moisture_percent":
                case "water_level_percent":
                    display = val != null ? `${val}%` : "--";
                    color = val < 20 ? C.alert : C.text;
                    break;
                case "interval_ms":
                    display = val != null ? `${(val / 1000).toFixed(0)}s` : "--";
                    color = C.textLight;
                    break;
                default:
                    display = (val ?? "--").toString();
            }

            doc.fillColor(color).fontSize(T.body.size - 0.5).font(T.body.font)
                .text(display, col.x + PAD, currentY + 5,
                    { width: col.w - PAD * 2, ellipsis: true });
        });

        currentY += ROW_H;
        hasContentOnCurrentPage = true;
    }
    currentY += 14;

    sectionHeading("3. Statistical Analysis", "", 100);

    const analysisText = generateAnalysisText(metricDefs, metric);
    renderText(analysisText, { align: "justify", marginBottom: 16 });

    const CARD_H = 70;

    for (const m of metricDefs) {
        if (metric && metric !== "all" &&
            m.key !== metric &&
            m.key !== metric + "_ppm" &&
            m.key !== metric + "_percent") continue;
        if (m.stats.count === 0) continue;

        ensureSpace(CARD_H + 10);
        const s = m.stats;

        // Card shell
        doc.roundedRect(MARGIN, currentY, CONTENT_W, CARD_H, 6)
            .fill(C.cardBg).stroke(C.border);

        // Left accent
        doc.rect(MARGIN, currentY, 6, CARD_H).fill(m.color);

        // Title
        doc.fillColor(m.color).fontSize(9).font("Helvetica-Bold")
            .text(m.name.toUpperCase(), MARGIN + 16, currentY + 10);

        // Stats row
        const cols = [
            { label: "MIN", value: `${s.min} ${m.unit}` },
            { label: "MAX", value: `${s.max} ${m.unit}` },
            { label: "AVERAGE", value: `${s.avg} ${m.unit}` },
            { label: "STD DEV", value: `${s.stdDev} ${m.unit}` },
            { label: "SAMPLES", value: `${s.count}` },
        ];
        const cw = (CONTENT_W - 20) / cols.length;
        cols.forEach((c, idx) => {
            const cx = MARGIN + 16 + idx * cw;
            doc.fillColor(C.textMuted).fontSize(7).font("Helvetica-Bold")
                .text(c.label, cx, currentY + 30, { width: cw - 4 });
            doc.fillColor(C.text).fontSize(11).font("Helvetica-Bold")
                .text(c.value, cx, currentY + 41, { width: cw - 4 });
        });

        currentY += CARD_H + 10;
        hasContentOnCurrentPage = true;
    }
    const CHART_H = 272;
    const CHART_BOX = CHART_H + 38;

    sectionHeading("4. Data Visualizations", "", CHART_BOX);
    const chartImage = await generateFullChart(data, metric);
    if (chartImage) {
        ensureSpace(CHART_BOX + 10);
        doc.roundedRect(MARGIN, currentY, CONTENT_W, CHART_H, 8)
            .fill(C.cardBg).stroke(C.borderDark);
        doc.image(chartImage, MARGIN + 12, currentY + 12, { fit: [CONTENT_W - 24, CHART_H - 24] });
        currentY += CHART_H + 8;
        doc.fillColor(C.textLight).fontSize(T.caption.size).font(T.caption.font)
            .text(
                "Figure 1: Environmental parameter trends over time (percent on left where applicable; temperature and CO2 on right scales).",
                MARGIN, currentY, { align: "center", width: CONTENT_W }
            );
        currentY += 24;
        hasContentOnCurrentPage = true;
    } else {
        ensureSpace(88);
        doc.roundedRect(MARGIN, currentY, CONTENT_W, 76, 8)
            .fill("#F8FAFC").stroke(C.border);
        doc.fillColor(C.textMuted).fontSize(9).font("Helvetica")
            .text(
                "Trend chart could not be rendered on this host (no chart engine). " +
                "Charts are generated via QuickChart when native canvas is unavailable; ensure outbound HTTPS is allowed, " +
                "or run PDF export on a server with node-canvas installed.",
                MARGIN + 16, currentY + 14,
                { width: CONTENT_W - 32, align: "center" }
            );
        currentY += 88;
        hasContentOnCurrentPage = true;
    }

    // ── Figure 2: CO2 distribution pie ────────────────────────
    const showCO2 = !metric || metric === "all" || metric === "co2" || metric === "co2_ppm";
    if (showCO2) {
        const co2Vals = data.map((d) => d.co2_ppm || 0);
        const good = co2Vals.filter((v) => v > 0 && v < 800).length;
        const moderate = co2Vals.filter((v) => v >= 800 && v < 1000).length;
        const elevated = co2Vals.filter((v) => v >= 1000 && v < 1500).length;
        const high = co2Vals.filter((v) => v >= 1500).length;

        const pieData = [
            { label: "Good (< 800 ppm)", value: good, color: C.chart1 },
            { label: "Moderate (800–1000 ppm)", value: moderate, color: C.info },
            { label: "Elevated (1000–1500 ppm)", value: elevated, color: C.alert },
            { label: "High (> 1500 ppm)", value: high, color: C.warning },
        ].filter((d) => d.value > 0);

        if (pieData.length > 0) {
            const pieImage = await generatePieChart(pieData);
            if (pieImage) {
                ensureSpace(CHART_BOX + 10);
                doc.roundedRect(MARGIN, currentY, CONTENT_W, CHART_H, 8)
                    .fill(C.cardBg).stroke(C.borderDark);
                doc.image(pieImage, MARGIN + 12, currentY + 12, { fit: [CONTENT_W - 24, CHART_H - 24] });
                currentY += CHART_H + 8;
                doc.fillColor(C.textLight).fontSize(T.caption.size).font(T.caption.font)
                    .text("Figure 2: CO2 level distribution across all recorded readings",
                        MARGIN, currentY, { align: "center", width: CONTENT_W });
                currentY += 24;
                hasContentOnCurrentPage = true;
            } else {
                ensureSpace(72);
                doc.roundedRect(MARGIN, currentY, CONTENT_W, 64, 8)
                    .fill("#F8FAFC").stroke(C.border);
                doc.fillColor(C.textMuted).fontSize(9).font("Helvetica")
                    .text(
                        "CO2 distribution chart could not be generated (same requirements as Figure 1). " +
                        `Readings by band: ${pieData.map((p) => `${p.value}`).join(" / ")} ` +
                        `(good / moderate / elevated / high).`,
                        MARGIN + 14, currentY + 12,
                        { width: CONTENT_W - 28, align: "left" }
                    );
                currentY += 76;
                hasContentOnCurrentPage = true;
            }
        }
    }

    // ─────────────────────────────────────────────────────────
    // 5. RECOMMENDATIONS
    // ─────────────────────────────────────────────────────────
    sectionHeading("5. Recommendations", "", 80);

    const recsText = generateRecommendations(metricDefs, data, metric);
    renderText(recsText, { align: "justify" });

    if (rawData.length !== data.length) {
        rule(8, 8);
        ensureSpace(34);
        doc.roundedRect(MARGIN, currentY, CONTENT_W, 28, 4)
            .fill("#FFFBF0").stroke(C.alert);
        doc.fillColor(C.alert).fontSize(8).font("Helvetica-Bold")
            .text("DATA QUALITY NOTE", MARGIN + 10, currentY + 8);
        doc.fillColor(C.text).fontSize(8).font("Helvetica")
            .text(
                `${rawData.length - data.length} of ${rawData.length} records were excluded ` +
                `(device heartbeats with no sensor readings).`,
                MARGIN + 110, currentY + 8,
                { width: CONTENT_W - 120 }
            );
        currentY += 34;
        hasContentOnCurrentPage = true;
    }
    if (hasContentOnCurrentPage) addFooter();

    doc.end();

    await new Promise((resolve, reject) => {
        writeStream.on("finish", resolve);
        writeStream.on("error", reject);
    });

    const stat = fs.statSync(filePath);
    if (stat.size === 0) throw new Error("Generated PDF file is empty");
    return filePath;
};