import { ChartJSNodeCanvas } from "chartjs-node-canvas";

const chartCanvas = new ChartJSNodeCanvas({
  width: 600,
  height: 300
});

export const generateChart = async (labels, tempData, humidityData) => {
  const config = {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Temperature",
          data: tempData
        },
        {
          label: "Humidity",
          data: humidityData
        }
      ]
    }
  };

  return await chartCanvas.renderToBuffer(config);
};