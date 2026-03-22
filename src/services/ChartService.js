import { ChartJSNodeCanvas } from "chartjs-node-canvas";

const chartCanvas = new ChartJSNodeCanvas({
    width: 600,
    height: 300
});

export const generateChart = async (labels, datasets) => {
    const config = {
        type: "line",
        data: {
            labels,
            datasets
        }
    };

    return await chartCanvas.renderToBuffer(config);
};