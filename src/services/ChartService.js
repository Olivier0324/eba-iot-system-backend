// services/ChartService.js
import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import { registerables } from 'chart.js';

const chartCanvas = new ChartJSNodeCanvas({
    width: 800,
    height: 400,
    chartCallback: (ChartJS) => {
        ChartJS.register(...registerables);
    }
});

export const generateChart = async (labels, datasets) => {
    const config = {
        type: "line",
        data: {
            labels,
            datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        font: { size: 12 }
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    grid: { color: '#E0E0E0' }
                },
                x: {
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45,
                        autoSkip: true,
                        maxTicksLimit: 15
                    }
                }
            },
            elements: {
                point: {
                    radius: 2,
                    hoverRadius: 5
                },
                line: {
                    tension: 0.3,
                    borderWidth: 2
                }
            }
        }
    };

    return await chartCanvas.renderToBuffer(config);
};

export const generatePieChart = async (data) => {
    const config = {
        type: "pie",
        data: {
            labels: data.map(d => d.label),
            datasets: [{
                data: data.map(d => d.value),
                backgroundColor: data.map(d => d.color),
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        font: { size: 11 }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    };

    return await chartCanvas.renderToBuffer(config);
};