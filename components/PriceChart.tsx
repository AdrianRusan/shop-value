'use client'

import React, { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import 'chartjs-adapter-date-fns';

type PriceChartProps = {
  priceHistory: { date: Date; price: number }[];
};

const PriceChart: React.FC<PriceChartProps> = ({ priceHistory }) => {
  const chartRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (chartRef.current) {
      const chartInstance = new Chart(chartRef.current, {
        type: 'line',
        data: {
          labels: priceHistory.map((data) => data.date),
          datasets: [
            {
              label: 'Price over Time',
              data: priceHistory.map((data) => data.price),
              borderColor: 'rgba(75, 192, 192, 1)',
              borderWidth: 2,
              fill: true,
            },
          ],
        },
        options: {
          scales: {
            x: {
              type: 'time',
              time: {
                unit: 'day',
                displayFormats: {
                  day: 'dd MMM yy - p',
                },
              },
            },
            y: {
              beginAtZero: true,
              ticks: {
                callback: (value) => value + ' RON',
              },
            },
          },
        },
      });
      return () => {
        if (chartInstance) {
          chartInstance.destroy();
        }
      };
    }
    
  }, [priceHistory]);

  return <canvas className="hidden" ref={chartRef} />;
};

export default PriceChart;
