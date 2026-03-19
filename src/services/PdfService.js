import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { generateChart } from "./ChartService.js";

export const generatePDF = async (data) => {
    const fileName = `report_${Date.now()}.pdf`;
    const filePath = path.join("reports", fileName);

    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(fs.createWriteStream(filePath));

    // ================= HEADER =================
    doc.image("assets/logo.png", 50, 30, { width: 50 });

    doc
        .fontSize(18)
        .text("Smart Agro Report", 120, 40);

    doc.moveDown(2);

    // ================= SUMMARY =================
    doc.fontSize(12).text(`Records: ${data.length}`);
    doc.text(`Generated: ${new Date().toLocaleString()}`);

    doc.moveDown();

    // ================= TABLE HEADER =================
    let y = 150;

    doc.text("Time", 50, y);
    doc.text("Temp", 150, y);
    doc.text("Humidity", 220, y);
    doc.text("CO2", 320, y);

    y += 20;

    // ================= TABLE DATA =================
    data.forEach((d) => {
        if (y > 700) {
            doc.addPage();
            y = 50;
        }

        doc.text(new Date(d.timestamp).toLocaleTimeString(), 50, y);
        doc.text(d.temperature.toString(), 150, y);
        doc.text(d.humidity.toString(), 220, y);
        doc.text(d.co2_ppm.toString(), 320, y);

        y += 20;
    });

    // ================= CHART =================
    const labels = data.map(d => new Date(d.timestamp).toLocaleTimeString());
    const tempData = data.map(d => d.temperature);
    const humidityData = data.map(d => d.humidity);

    const chartImage = await generateChart(labels, tempData, humidityData);

    doc.addPage();
    doc.text("Sensor Trends", { align: "center" });

    doc.image(chartImage, {
        fit: [500, 300],
        align: "center"
    });

    doc.end();

    return filePath;
};