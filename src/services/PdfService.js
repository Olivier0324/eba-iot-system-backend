// services/PdfService.js
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { generateChart } from "./ChartService.js";

export const generatePDF = async (data, options) => {
    const { metric } = options;

    // Ensure reports directory exists
    const reportsDir = path.join(process.cwd(), "reports");
    if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
    }

    const fileName = `report_${Date.now()}.pdf`;
    const filePath = path.join(reportsDir, fileName);

    const doc = new PDFDocument({
        margin: 50,
        size: 'A4',
        info: {
            Title: 'EBA SYSTEM REPORT',
            Author: 'EBA System',
            Producer: 'ECOBASED ADAPTATION SYSTEM PDF GENERATOR'
        }
    });

    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);

    // Helper function for consistent styling
    const styles = {
        header: { fontSize: 24, color: '#2E7D32' },  // Dark green
        subheader: { fontSize: 16, color: '#1B5E20' }, // Darker green
        normal: { fontSize: 10, color: '#333333' },
        small: { fontSize: 8, color: '#666666' },
        tableHeader: { fontSize: 11, color: '#FFFFFF', backgroundColor: '#2E7D32' },
        tableRow: { fontSize: 10, color: '#333333' }
    };

    // Track page number
    let pageNumber = 1;

    // Footer function - NO recursion
    const addFooter = () => {
        doc.save();
        doc.strokeColor('#E0E0E0')
            .lineWidth(1)
            .moveTo(50, doc.page.height - 50)
            .lineTo(doc.page.width - 50, doc.page.height - 50)
            .stroke();

        doc.fillColor(styles.small.color)
            .fontSize(styles.small.fontSize)
            .font('Helvetica')
            .text(
                `ECOBASED SYSTEM - Confidential | Page ${pageNumber}`,
                50,
                doc.page.height - 40,
                { align: 'center', width: doc.page.width - 100 }
            );
        doc.restore();
    };

    try {
        // ================= HEADER SECTION =================
        // Background rectangle for header
        doc.rect(0, 0, doc.page.width, 100)
            .fill('#F5F5F5');

        // Logo and title
        const logoPath = path.join(process.cwd(), "assets", "logo.png");
        if (fs.existsSync(logoPath)) {
            try {
                doc.image(logoPath, 50, 30, { width: 50 });
            } catch (error) {
                doc.rect(50, 30, 50, 50).fill('#2E7D32');
            }
        } else {
            doc.rect(50, 30, 50, 50).fill('#2E7D32');
        }

        doc.fillColor(styles.header.color)
            .fontSize(styles.header.fontSize)
            .font('Helvetica-Bold')
            .text("EBA SYSTEM REPORT", 120, 40);

        // Add subtitle with date
        doc.fillColor(styles.small.color)
            .fontSize(styles.small.fontSize)
            .font('Helvetica')
            .text(`Generated: ${new Date().toLocaleString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            })}`, 120, 70);

        // ================= SUMMARY SECTION =================
        let y = 120;

        // Summary card
        doc.roundedRect(50, y, 500, 60, 5)
            .fill('#F8F9FA')
            .stroke('#E0E0E0');

        doc.fillColor('#000000')
            .fontSize(14)
            .font('Helvetica-Bold')
            .text('Report Summary', 70, y + 10);

        const dateRangeText = data.length > 0
            ? `${new Date(data[0]?.timestamp).toLocaleDateString()} - ${new Date(data[data.length - 1]?.timestamp).toLocaleDateString()}`
            : 'No data available';

        doc.fontSize(styles.normal.fontSize)
            .font('Helvetica')
            .fillColor('#495057')
            .text(`Total Records: ${data.length}`, 70, y + 35)
            .text(`Date Range: ${dateRangeText}`, 250, y + 35)
            .text(`Metrics: ${metric ? metric.toUpperCase() : 'All Metrics'}`, 450, y + 35);

        y += 80;

        // ================= TABLE SECTION =================
        if (data.length > 0) {
            // Table title
            doc.fillColor(styles.subheader.color)
                .fontSize(styles.subheader.fontSize)
                .font('Helvetica-Bold')
                .text('Sensor Data Details', 50, y);

            y += 25;

            // Table header with background
            doc.rect(50, y - 5, 500, 25)
                .fill(styles.tableHeader.backgroundColor);

            doc.fillColor(styles.tableHeader.color)
                .fontSize(styles.tableHeader.fontSize)
                .font('Helvetica-Bold')
                .text('Timestamp', 55, y)
                .text('Temperature', 150, y)
                .text('Humidity', 240, y)
                .text('CO₂ (ppm)', 330, y)
                .text('Water Level', 420, y);

            y += 25;

            // ================= TABLE DATA =================
            let rowCount = 0;

            for (const d of data) {
                if (y > 750) {
                    addFooter(); // Add footer to current page before new page
                    doc.addPage();
                    pageNumber++;
                    y = 50;

                    // Repeat header on new page
                    doc.rect(50, y - 5, 500, 25)
                        .fill(styles.tableHeader.backgroundColor);

                    doc.fillColor(styles.tableHeader.color)
                        .fontSize(styles.tableHeader.fontSize)
                        .font('Helvetica-Bold')
                        .text('Timestamp', 55, y)
                        .text('Temperature', 150, y)
                        .text('Humidity', 240, y)
                        .text('CO₂ (ppm)', 330, y)
                        .text('Water Level', 420, y);

                    y += 25;
                }

                // Alternate row colors for better readability
                if (rowCount % 2 === 0) {
                    doc.rect(50, y - 5, 500, 20)
                        .fill('#F8F9FA');
                }

                // Add temperature with color coding
                const tempColor = d.temperature > 30 ? '#DC3545' : d.temperature < 15 ? '#0D6EFD' : '#28A745';

                doc.fillColor(styles.tableRow.color)
                    .fontSize(styles.tableRow.fontSize)
                    .font('Helvetica')
                    .text(new Date(d.timestamp).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    }), 55, y);

                doc.fillColor(tempColor)
                    .text(`${d.temperature?.toFixed(1) || '0'}°C`, 150, y);

                doc.fillColor(styles.tableRow.color)
                    .text(`${d.humidity?.toFixed(1) || '0'}%`, 240, y)
                    .text(`${d.co2_ppm || 0}`, 330, y)
                    .text(`${d.water_level_percent || 0}%`, 420, y);

                y += 20;
                rowCount++;
            }
        }

        // ================= STATISTICS SECTION =================
        if (data.length > 0) {
            addFooter(); // Add footer to current page before new page
            doc.addPage();
            pageNumber++;

            // Page title
            doc.fillColor(styles.header.color)
                .fontSize(styles.header.fontSize)
                .font('Helvetica-Bold')
                .text('Statistical Analysis', 50, 50);

            y = 100;

            // Calculate statistics
            const temps = data.map(d => d.temperature).filter(v => v != null);
            const humidities = data.map(d => d.humidity).filter(v => v != null);
            const co2s = data.map(d => d.co2_ppm).filter(v => v != null);

            const calculateStats = (values) => {
                if (values.length === 0) return { min: '0', max: '0', avg: '0' };
                return {
                    min: Math.min(...values).toFixed(1),
                    max: Math.max(...values).toFixed(1),
                    avg: (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1)
                };
            };

            const tempStats = calculateStats(temps);
            const humidityStats = calculateStats(humidities);
            const co2Stats = calculateStats(co2s);

            // Statistics cards
            const stats = [
                { title: 'Temperature (°C)', data: tempStats, color: '#FF6B6B' },
                { title: 'Humidity (%)', data: humidityStats, color: '#4ECDC4' },
                { title: 'CO₂ (ppm)', data: co2Stats, color: '#45B7D1' }
            ];

            stats.forEach((stat, index) => {
                const cardY = y + (index * 100);

                // Card background
                doc.roundedRect(50, cardY, 500, 80, 5)
                    .fill('#FFFFFF')
                    .stroke('#E0E0E0');

                // Colored header
                doc.rect(50, cardY, 500, 25)
                    .fill(stat.color);

                doc.fillColor('#FFFFFF')
                    .fontSize(14)
                    .font('Helvetica-Bold')
                    .text(stat.title, 70, cardY + 5);

                // Stats display
                doc.fillColor('#000000')
                    .fontSize(12)
                    .font('Helvetica')
                    .text(`Min: ${stat.data.min}`, 70, cardY + 40)
                    .text(`Max: ${stat.data.max}`, 200, cardY + 40)
                    .text(`Avg: ${stat.data.avg}`, 330, cardY + 40);
            });
        }

        // ================= CHART SECTION =================
        if (data.length > 0) {
            const labels = data.map(d =>
                new Date(d.timestamp).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit'
                })
            );

            let datasets = [];

            if (metric === "temperature") {
                datasets.push({
                    label: "Temperature (°C)",
                    data: data.map(d => d.temperature),
                    borderColor: '#FF6B6B',
                    backgroundColor: 'rgba(255, 107, 107, 0.1)'
                });
            } else if (metric === "humidity") {
                datasets.push({
                    label: "Humidity (%)",
                    data: data.map(d => d.humidity),
                    borderColor: '#4ECDC4',
                    backgroundColor: 'rgba(78, 205, 196, 0.1)'
                });
            } else if (metric === "co2") {
                datasets.push({
                    label: "CO₂ (ppm)",
                    data: data.map(d => d.co2_ppm),
                    borderColor: '#45B7D1',
                    backgroundColor: 'rgba(69, 183, 209, 0.1)'
                });
            } else if (metric === "water") {
                datasets.push({
                    label: "Water Level (%)",
                    data: data.map(d => d.water_level_percent),
                    borderColor: '#96CEB4',
                    backgroundColor: 'rgba(150, 206, 180, 0.1)'
                });
            } else {
                // If no metric specified → include all
                datasets = [
                    {
                        label: "Temperature (°C)",
                        data: data.map(d => d.temperature),
                        borderColor: '#FF6B6B',
                        backgroundColor: 'rgba(255, 107, 107, 0.1)'
                    },
                    {
                        label: "Humidity (%)",
                        data: data.map(d => d.humidity),
                        borderColor: '#4ECDC4',
                        backgroundColor: 'rgba(78, 205, 196, 0.1)'
                    }
                ];
            }

            // Filter out datasets with no valid data
            datasets = datasets.filter(ds => ds.data.some(v => v != null && !isNaN(v)));

            if (datasets.length > 0) {
                const chartImage = await generateChart(labels, datasets);

                if (chartImage && chartImage.length > 0) {
                    addFooter(); // Add footer to current page before new page
                    doc.addPage();
                    pageNumber++;

                    // Chart title
                    doc.fillColor(styles.subheader.color)
                        .fontSize(styles.subheader.fontSize)
                        .font('Helvetica-Bold')
                        .text('Sensor Trends Visualization', 50, 50, { align: 'left' });

                    // Add chart with border
                    doc.roundedRect(50, 80, 500, 300, 5)
                        .fill('#FFFFFF')
                        .stroke('#E0E0E0');

                    doc.image(chartImage, 75, 100, {
                        fit: [450, 260],
                        align: 'center'
                    });
                }
            }
        }

        // Add final footer to last page
        addFooter();

    } catch (error) {
        console.error("Error adding content to PDF:", error);
        throw error;
    } finally {
        doc.end();
    }

    // Wait for file to be written
    await new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
    });

    // Verify file
    if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        console.log("PDF file size:", stats.size, "bytes");

        if (stats.size === 0) {
            throw new Error("Generated PDF file is empty");
        }

        return filePath;
    } else {
        throw new Error("PDF file was not created");
    }
};