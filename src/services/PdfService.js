// services/PdfService.js
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { generateChart, generatePieChart } from "./ChartService.js";

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

const calculateStats = (values) => {
    if (!values || values.length === 0) return { min: "0", max: "0", avg: "0", stdDev: "0" };
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / values.length;
    return {
        min: Math.min(...values).toFixed(1),
        max: Math.max(...values).toFixed(1),
        avg: avg.toFixed(1),
        stdDev: Math.sqrt(variance).toFixed(1),
    };
};

const generateAnalysisText = (metrics, data, selectedMetric) => {
    if (selectedMetric && selectedMetric !== "all") {
        const filteredMetric = metrics.find((m) => m.key === selectedMetric || m.key === selectedMetric + "_ppm");
        if (filteredMetric && filteredMetric.data && filteredMetric.data.length > 0) {
            const stats = calculateStats(filteredMetric.data);
            let text = `This section provides statistical analysis of ${filteredMetric.name}. `;
            text += `Values ranged from ${stats.min} to ${stats.max} ${filteredMetric.unit}, `;
            text += `with an average of ${stats.avg} ${filteredMetric.unit} and a standard deviation of ${stats.stdDev} ${filteredMetric.unit}. `;
            
            if (selectedMetric === "co2" || selectedMetric === "co2_ppm") {
                const avgCO2 = parseFloat(stats.avg);
                if (avgCO2 > 1000) text += "CO2 levels exceed recommended thresholds, indicating poor indoor air quality that requires immediate ventilation.";
                else if (avgCO2 > 800) text += "CO2 levels are elevated. Consider increasing ventilation to improve air quality.";
                else text += "CO2 levels are within acceptable ranges.";
            }
            return text;
        }
    }
    
    let text = "This section provides statistical analysis of all monitored environmental parameters. ";
    for (const metric of metrics) {
        if (!metric.data || metric.data.length === 0) continue;
        const stats = calculateStats(metric.data);
        text += `For ${metric.name}, values ranged from ${stats.min} to ${stats.max} ${metric.unit}, `;
        text += `with an average of ${stats.avg} ${metric.unit} and a standard deviation of ${stats.stdDev} ${metric.unit}. `;
    }
    return text;
};

const generateRecommendations = (metrics, data, selectedMetric) => {
    const recommendations = [];
    
    if (!data || data.length === 0) {
        return "No data available for recommendations.";
    }

    const avgTemp = data.reduce((s, d) => s + (d.temperature || 0), 0) / data.length;
    const avgHumidity = data.reduce((s, d) => s + (d.humidity || 0), 0) / data.length;
    const avgCO2 = data.reduce((s, d) => s + (d.co2_ppm || 0), 0) / data.length;

    if (!selectedMetric || selectedMetric === "all" || selectedMetric === "temperature") {
        if (avgTemp > 28) recommendations.push("• High average temperature detected. Consider improving cooling systems.");
        else if (avgTemp < 18) recommendations.push("• Low average temperature detected. Consider heating or insulation improvements.");
        else recommendations.push("• Temperature levels are within optimal range. Continue regular monitoring.");
    }
    
    if (!selectedMetric || selectedMetric === "all" || selectedMetric === "humidity") {
        if (avgHumidity > 75) recommendations.push("• Elevated humidity levels may lead to mold growth. Ensure proper ventilation.");
        else if (avgHumidity < 30) recommendations.push("• Low humidity may cause discomfort. Consider humidification.");
        else recommendations.push("• Humidity levels are within optimal range. Continue regular monitoring.");
    }
    
    if (!selectedMetric || selectedMetric === "all" || selectedMetric === "co2" || selectedMetric === "co2_ppm") {
        if (avgCO2 > 1000) recommendations.push("• CRITICAL: CO2 levels exceed safety thresholds. Implement immediate ventilation protocols.");
        else if (avgCO2 > 800) recommendations.push("• Elevated CO2 levels detected. Schedule regular ventilation.");
        else recommendations.push("• CO2 levels are within acceptable ranges. Continue regular monitoring.");
    }
    
    if (recommendations.length === 0)
        recommendations.push("• All monitored parameters are within acceptable ranges. Continue regular monitoring.");

    return "Based on collected data, the following actions are recommended:\n\n" + recommendations.join("\n");
};

// ─────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────

export const generatePDF = async (data, options) => {
    if (!data || !Array.isArray(data) || data.length === 0) {
        throw new Error("Invalid or empty data provided for PDF generation");
    }

    const { metric, type } = options || {};

    const reportsDir = path.join(process.cwd(), "reports");
    if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

    const fileName = `report_${Date.now()}.pdf`;
    const filePath = path.join(reportsDir, fileName);

    const doc = new PDFDocument({ margin: 50, size: "A4", autoFirstPage: true });
    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);

    // ── Design tokens ──────────────────────────────────────────
    const C = {
        primary: "#2E7D32", primaryDark: "#1B5E20",
        warning: "#DC3545", info: "#0D6EFD",
        success: "#28A745", text: "#333333",
        textLight: "#666666", border: "#E0E0E0",
        background: "#F5F5F5", cardBg: "#F8F9FA",
        white: "#FFFFFF",
        chart1: "#FF6B6B", chart2: "#4ECDC4", chart3: "#45B7D1",
    };

    const T = {
        h1: { size: 20, font: "Helvetica-Bold" },
        h2: { size: 16, font: "Helvetica-Bold" },
        h3: { size: 12, font: "Helvetica-Bold" },
        body: { size: 10, font: "Helvetica" },
        small: { size: 8, font: "Helvetica" },
        caption: { size: 9, font: "Helvetica" },
    };

    // ── Page geometry ──────────────────────────────────────────
    const PAGE_TOP = 50;
    const PAGE_BOTTOM = doc.page.height - 55;  // ~787 on A4
    const CONTENT_W = 500;

    let pageNumber = 1;
    let currentY = PAGE_TOP;
    let hasContentOnCurrentPage = false; // Track if current page has content

    // ── Footer ─────────────────────────────────────────────────
    const addFooter = () => {
        // Only add footer if there's content on this page
        if (!hasContentOnCurrentPage) return;
        
        doc.save();
        doc.strokeColor(C.border).lineWidth(0.5)
            .moveTo(50, doc.page.height - 45)
            .lineTo(doc.page.width - 50, doc.page.height - 45)
            .stroke();
        doc.fillColor(C.textLight).fontSize(T.small.size).font(T.small.font)
            .text(
                `ECOBASED SYSTEM - Confidential | Generated: ${new Date().toLocaleDateString()} | Page ${pageNumber}`,
                50, doc.page.height - 35,
                { align: "center", width: doc.page.width - 100 }
            );
        doc.restore();
    };

    // ── Page-break utilities ───────────────────────────────────

    /** Always open a new page. */
    const newPage = () => {
        addFooter(); // Add footer to current page before moving to next
        doc.addPage();
        pageNumber++;
        currentY = PAGE_TOP;
        hasContentOnCurrentPage = false; // Reset content flag for new page
    };

    /**
     * Open a new page only when `neededHeight` won't fit below currentY.
     */
    const ensureSpace = (neededHeight) => {
        if (currentY + neededHeight > PAGE_BOTTOM) newPage();
    };

    /**
     * Draw a section heading, opening a new page only when BOTH:
     *   (a) page has real content on it already — i.e. we are NOT
     *       already sitting near the top of a freshly-opened page, AND
     *   (b) heading + `minContent` px would overflow the current page.
     *
     * This dual guard is what eliminates blank pages:
     *   • ensureSpace() called just before us may have already flipped
     *     to a new page, leaving currentY at PAGE_TOP. Without guard (a)
     *     we would flip AGAIN, leaving that new page entirely blank.
     *   • Guard (b) ensures we still break when a section genuinely
     *     cannot fit on the remaining space.
     */
    const HEADING_H = 28;   // h2 font + line gap
    const FRESH_PAGE_THRESHOLD = 80;  // currentY <= PAGE_TOP + this  →  page is "fresh"

    const sectionHeading = (label, minContent = 100) => {
        const isOnFreshPage = currentY <= PAGE_TOP + FRESH_PAGE_THRESHOLD;
        const wouldOverflow = currentY + HEADING_H + minContent > PAGE_BOTTOM;

        if (!isOnFreshPage && wouldOverflow) newPage();

        doc.fillColor(C.primary).fontSize(T.h2.size).font(T.h2.font)
            .text(label, 50, currentY);
        currentY += HEADING_H;
        hasContentOnCurrentPage = true; // Mark that this page now has content
    };

    /**
     * Improved text rendering with proper page breaks
     */
    const renderText = (text, options = {}) => {
        const {
            width = CONTENT_W,
            align = "left",
            fontSize = T.body.size,
            font = T.body.font,
            color = C.text,
            lineHeight = 1.4,
            marginBottom = 10
        } = options;

        doc.fontSize(fontSize).font(font).fillColor(color);
        
        // Calculate how much space the text will take
        const textHeight = doc.heightOfString(text, { width, align });
        
        // Check if we need a page break
        ensureSpace(textHeight + marginBottom);
        
        // Render the text
        doc.text(text, 50, currentY, { width, align });
        currentY += textHeight + marginBottom;
        hasContentOnCurrentPage = true; // Mark that this page now has content
    };

    // ─────────────────────────────────────────────────────────
    // 0. COVER HEADER  (first page)
    // ─────────────────────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 85).fill(C.background);
    hasContentOnCurrentPage = true; // Mark that this page now has content

    const logoPath = path.join(process.cwd(), "assets", "logo.png");
    if (fs.existsSync(logoPath)) {
        try { doc.image(logoPath, 50, 20, { width: 45 }); }
        catch { doc.rect(50, 20, 45, 45).fill(C.primary); }
    } else {
        doc.rect(50, 20, 45, 45).fill(C.primary);
    }

    doc.fillColor(C.primary).fontSize(T.h1.size).font(T.h1.font)
        .text("ENVIRONMENTAL MONITORING REPORT", 110, 28, { width: 400 });
    doc.fillColor(C.primaryDark).fontSize(10).font("Helvetica-Bold")
        .text(`Report Type: ${type?.toUpperCase() || "CUSTOM"}`, 110, 55);
    doc.fillColor(C.textLight).fontSize(T.small.size).font(T.small.font)
        .text(`Generated: ${new Date().toLocaleString()}`, 110, 72);

    currentY = 100;

    // ─────────────────────────────────────────────────────────
    // 1. EXECUTIVE SUMMARY
    // ─────────────────────────────────────────────────────────
    sectionHeading("1. Executive Summary");

    const dateRange =
        data.length > 0
            ? `${new Date(data[0].timestamp).toLocaleDateString()} to ${new Date(data[data.length - 1].timestamp).toLocaleDateString()}`
            : "No data";

    const avgTemp = data.length ? (data.reduce((s, d) => s + (d.temperature || 0), 0) / data.length).toFixed(1) : 0;
    const maxTemp = data.length ? Math.max(...data.map((d) => d.temperature || 0)).toFixed(1) : 0;
    const minTemp = data.length ? Math.min(...data.map((d) => d.temperature || 0)).toFixed(1) : 0;
    const avgHumidity = data.length ? (data.reduce((s, d) => s + (d.humidity || 0), 0) / data.length).toFixed(1) : 0;
    const avgCO2 = data.length ? Math.round(data.reduce((s, d) => s + (d.co2_ppm || 0), 0) / data.length) : 0;

    let summaryText = `This report presents environmental monitoring data collected from EBA System over period of ${dateRange}. `;
    summaryText += `A total of ${data.length} data points were recorded and analysed. `;
    if (!metric || metric === "all" || metric === "temperature")
        summaryText += `During this period, the average temperature was ${avgTemp}°C, with a maximum of ${maxTemp}°C and a minimum of ${minTemp}°C. `;
    if (!metric || metric === "all" || metric === "humidity")
        summaryText += `Relative humidity averaged ${avgHumidity}%. `;
    if (!metric || metric === "all" || metric === "co2" || metric === "co2_ppm")
        summaryText += `CO2 levels averaged ${avgCO2} ppm. `;
    if (avgCO2 > 1000 && (!metric || metric === "all" || metric === "co2" || metric === "co2_ppm"))
        summaryText += `CO2 levels exceeded recommended thresholds, indicating poor air quality that requires ventilation.`;

    // Use the new renderText function
    renderText(summaryText, { align: "justify" });

    // Data overview card
    ensureSpace(70);
    doc.roundedRect(50, currentY, CONTENT_W, 60, 8).fill(C.cardBg).stroke(C.border);
    doc.fillColor(C.primaryDark).fontSize(T.h3.size).font(T.h3.font)
        .text("Data Overview", 70, currentY + 10);

    let parametersText = "Parameters: ";
    if (!metric || metric === "all") parametersText += "Temperature, Humidity, CO2, Soil Moisture, Water Level";
    else parametersText += metric.charAt(0).toUpperCase() + metric.slice(1).replace("_ppm", "").replace("_percent", "");

    doc.fontSize(T.body.size).font(T.body.font).fillColor(C.text)
        .text(`Total Records: ${data.length}`, 70, currentY + 35)
        .text(`Date Range: ${dateRange}`, 220, currentY + 35)
        .text(parametersText, 400, currentY + 35, { width: 140 });
    currentY += 75;
    hasContentOnCurrentPage = true; // Mark that this page now has content

    // ─────────────────────────────────────────────────────────
    // 2. DETAILED SENSOR DATA TABLE
    // ─────────────────────────────────────────────────────────
    sectionHeading("2. Detailed Sensor Data", 80);

    const allColumns = [
        { key: "timestamp", label: "Timestamp", baseW: 120 },
        { key: "temperature", label: "Temp (°C)", baseW: 80, show: !metric || metric === "temperature" || metric === "all" },
        { key: "humidity", label: "Humidity (%)", baseW: 80, show: !metric || metric === "humidity" || metric === "all" },
        { key: "co2_ppm", label: "CO2 (ppm)", baseW: 80, show: !metric || metric === "co2" || metric === "co2_ppm" || metric === "all" },
        { key: "soil_moisture_percent", label: "Soil (%)", baseW: 70, show: !metric || metric === "soil" || metric === "all" },
        { key: "water_level_percent", label: "Water (%)", baseW: 70, show: !metric || metric === "water" || metric === "all" },
    ];

    const visCols = allColumns.filter((c) => c.key === "timestamp" || c.show);
    const totalBaseW = visCols.reduce((s, c) => s + c.baseW, 0);
    let xCursor = 50;
    visCols.forEach((c) => {
        c.w = Math.round((c.baseW / totalBaseW) * CONTENT_W);
        c.x = xCursor;
        xCursor += c.w;
    });

    const ROW_H = 20;
    const HEAD_H = 26;
    const COL_PAD = 4;

    // Draw header at currentY — caller is responsible for ensureSpace.
    // No ensureSpace/newPage inside here to avoid double-breaks.
    const drawTableHeader = () => {
        doc.rect(50, currentY, CONTENT_W, HEAD_H).fill(C.primary);
        visCols.forEach((col) => {
            doc.fillColor(C.white).fontSize(T.body.size).font("Helvetica-Bold")
                .text(col.label, col.x + COL_PAD, currentY + 7,
                    { width: col.w - COL_PAD * 2, ellipsis: true });
        });
        currentY += HEAD_H;
        hasContentOnCurrentPage = true; // Mark that this page now has content
    };

    ensureSpace(HEAD_H + ROW_H);
    drawTableHeader();

    for (let i = 0; i < data.length; i++) {
        // If this row won't fit, flip page and redraw header
        if (currentY + ROW_H > PAGE_BOTTOM) {
            newPage();
            drawTableHeader();   // currentY is PAGE_TOP here — always fits
        }

        if (i % 2 === 0) doc.rect(50, currentY, CONTENT_W, ROW_H).fill(C.cardBg);

        const record = data[i];
        visCols.forEach((col) => {
            let display = "";
            let colour = C.text;
            const val = record[col.key];

            switch (col.key) {
                case "timestamp":
                    display = new Date(val).toLocaleString();
                    break;
                case "temperature":
                    display = `${(val || 0).toFixed(1)}°C`;
                    colour = val > 30 ? C.warning : val < 15 ? C.info : C.success;
                    break;
                case "humidity":
                    display = `${(val || 0).toFixed(1)}%`;
                    break;
                default:
                    display = (val ?? 0).toString();
            }

            doc.fillColor(colour).fontSize(T.body.size).font(T.body.font)
                .text(display, col.x + COL_PAD, currentY + 4,
                    { width: col.w - COL_PAD * 2, ellipsis: true });
        });

        currentY += ROW_H;
        hasContentOnCurrentPage = true; // Mark that this page now has content
    }

    currentY += 15;

    // ─────────────────────────────────────────────────────────
    // 3. STATISTICAL ANALYSIS
    // ─────────────────────────────────────────────────────────
    sectionHeading("3. Statistical Analysis");

    const metrics = [
        { name: "Temperature", key: "temperature", unit: "°C", color: C.chart1, data: data.map((d) => d.temperature).filter((v) => v != null) },
        { name: "Humidity", key: "humidity", unit: "%", color: C.chart2, data: data.map((d) => d.humidity).filter((v) => v != null) },
        { name: "CO2", key: "co2_ppm", unit: "ppm", color: C.chart3, data: data.map((d) => d.co2_ppm).filter((v) => v != null) },
    ];

    const analysisText = generateAnalysisText(metrics, data, metric);
    renderText(analysisText, { align: "justify", marginBottom: 20 });

    const CARD_H = 72;
    for (const m of metrics) {
        if (metric && metric !== "all" && m.key !== metric && m.key !== metric + "_ppm") continue;
        if (!m.data || m.data.length === 0) continue;

        ensureSpace(CARD_H + 12);
        const stats = calculateStats(m.data);
        doc.roundedRect(50, currentY, CONTENT_W, CARD_H, 8).fill(C.white).stroke(C.border);
        doc.rect(50, currentY, 8, CARD_H).fill(m.color);
        doc.fillColor(C.primaryDark).fontSize(T.h3.size).font(T.h3.font)
            .text(`${m.name} Analysis`, 68, currentY + 12);
        doc.fillColor(C.text).fontSize(T.body.size).font(T.body.font)
            .text(`Min: ${stats.min}${m.unit}`, 68, currentY + 38)
            .text(`Max: ${stats.max}${m.unit}`, 180, currentY + 38)
            .text(`Avg: ${stats.avg}${m.unit}`, 295, currentY + 38)
            .text(`Std Dev: ${stats.stdDev}${m.unit}`, 405, currentY + 38);
        currentY += CARD_H + 12;
        hasContentOnCurrentPage = true; // Mark that this page now has content
    }

    // ─────────────────────────────────────────────────────────
    // 4. DATA VISUALIZATIONS
    // ─────────────────────────────────────────────────────────
    const CHART_H = 260;
    const CHART_BOX_H = CHART_H + 30;   // chart box + caption

    sectionHeading("4. Data Visualizations", CHART_BOX_H);

    const sampleStep = Math.max(1, Math.floor(data.length / 30));
    const labels = data
        .filter((_, i) => i % sampleStep === 0)
        .map((d) => new Date(d.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));

    let datasets = [];
    if (metric === "temperature") {
        datasets.push({ label: "Temperature (°C)", data: data.map((d) => d.temperature || 0), borderColor: C.chart1, backgroundColor: "rgba(255,107,107,0.2)", tension: 0.4, fill: true, pointRadius: 2 });
    } else if (metric === "humidity") {
        datasets.push({ label: "Humidity (%)", data: data.map((d) => d.humidity || 0), borderColor: C.chart2, backgroundColor: "rgba(78,205,196,0.2)", tension: 0.4, fill: true, pointRadius: 2 });
    } else if (metric === "co2" || metric === "co2_ppm") {
        datasets.push({ label: "CO2 (ppm)", data: data.map((d) => d.co2_ppm || 0), borderColor: C.chart3, backgroundColor: "rgba(69,183,209,0.2)", tension: 0.4, fill: true, pointRadius: 2 });
    } else {
        if (data.some((d) => d.temperature != null)) datasets.push({ label: "Temperature (°C)", data: data.map((d) => d.temperature || 0), borderColor: C.chart1, tension: 0.4, fill: false, pointRadius: 1 });
        if (data.some((d) => d.humidity != null)) datasets.push({ label: "Humidity (%)", data: data.map((d) => d.humidity || 0), borderColor: C.chart2, tension: 0.4, fill: false, pointRadius: 1 });
    }

    if (datasets.length > 0) {
        const chartImage = await generateChart(labels, datasets);
        if (chartImage) {
            ensureSpace(CHART_BOX_H + 10);
            doc.roundedRect(50, currentY, CONTENT_W, CHART_H, 8).fill(C.white).stroke(C.border);
            doc.image(chartImage, 65, currentY + 10, { fit: [470, 240], align: "center" });
            currentY += CHART_H + 5;
            doc.fillColor(C.textLight).fontSize(T.caption.size).font(T.caption.font)
                .text("Figure 1: Time series analysis", 50, currentY,
                    { align: "center", width: CONTENT_W });
            currentY += 25;
            hasContentOnCurrentPage = true; // Mark that this page now has content
        }
    }

    if (data.length > 0 && (!metric || metric === "all" || metric === "co2" || metric === "co2_ppm")) {
        const co2Levels = data.map((d) => d.co2_ppm || 0);
        const pieData = [
            { label: "Good (< 800 ppm)", value: co2Levels.filter((v) => v < 800).length, color: C.success },
            { label: "Moderate (800–1000 ppm)", value: co2Levels.filter((v) => v >= 800 && v < 1000).length, color: C.info },
            { label: "Elevated (1000–1500 ppm)", value: co2Levels.filter((v) => v >= 1000 && v < 1500).length, color: C.warning },
            { label: "High (> 1500 ppm)", value: co2Levels.filter((v) => v >= 1500).length, color: C.warning },
        ].filter((d) => d.value > 0);

        if (pieData.length > 0) {
            const pieChartImage = await generatePieChart(pieData);
            if (pieChartImage) {
                ensureSpace(CHART_BOX_H + 10);
                doc.roundedRect(50, currentY, CONTENT_W, CHART_H, 8).fill(C.white).stroke(C.border);
                doc.image(pieChartImage, 65, currentY + 10, { fit: [470, 240], align: "center" });
                currentY += CHART_H + 5;
                doc.fillColor(C.textLight).fontSize(T.caption.size).font(T.caption.font)
                    .text("Figure 2: CO2 Level Distribution", 50, currentY,
                        { align: "center", width: CONTENT_W });
                currentY += 25;
                hasContentOnCurrentPage = true; // Mark that this page now has content
            }
        }
    }

    // ─────────────────────────────────────────────────────────
    // 5. RECOMMENDATIONS
    // ─────────────────────────────────────────────────────────
    sectionHeading("5. Recommendations");

    const recommendations = generateRecommendations(metrics, data, metric);
    renderText(recommendations, { align: "justify" });

    // Only add footer to the last page if it has content
    if (hasContentOnCurrentPage) {
        addFooter();
    }

    // ─────────────────────────────────────────────────────────
    doc.end();

    await new Promise((resolve, reject) => {
        writeStream.on("finish", resolve);
        writeStream.on("error", reject);
    });

    const fileStats = fs.statSync(filePath);
    if (fileStats.size === 0) throw new Error("Generated PDF file is empty");
    return filePath;
};
