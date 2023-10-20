'use client'

import React, { useEffect, useRef, useState } from 'react';
import Chart from 'chart.js/auto';
import 'chartjs-adapter-date-fns';

type PriceHistoryData = { date: Date; price: number };

type PriceTableChartProps = {
  priceHistory: PriceHistoryData[];
};

const PriceTableChart: React.FC<PriceTableChartProps> = ({ priceHistory }) => {
  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  const chartInstanceRef = useRef<Chart<'line'> | null>();

  const highlightPriceChanges = () => {
    const rows = document.querySelectorAll('tr');
    for (let i = 1; i < rows.length; i++) {
      const currentPriceElement = rows[i].children[1] as HTMLElement;
      const prevPriceElement = rows[i - 1].children[1] as HTMLElement;

      const currentPrice = parseFloat(currentPriceElement.textContent || '0');
      const prevPrice = parseFloat(prevPriceElement.textContent || '0');

      if (currentPrice > prevPrice) {
        currentPriceElement.style.color = 'red';
        currentPriceElement.style.fontWeight = 'bold';
      } else if (currentPrice < prevPrice) {
        currentPriceElement.style.color = 'green';
        currentPriceElement.style.fontWeight = 'bold';
      }
    }
  };

  useEffect(() => {
    if (chartRef.current && viewMode === 'chart') {
      chartInstanceRef.current = new Chart(chartRef.current, {
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
          responsive: true,
          scales: {
            x: {
              type: 'time',
              time: {
                unit: 'hour',
                displayFormats: { hour: 'dd MMM yyyy - p' },
              },
              bounds: 'ticks',
              ticks: { maxRotation: 30, minRotation: 30, padding: 12.5 },
            },
            y: { ticks: { callback: (value) => value + ' RON' } },
          },
        },
      });
    }

    return () => {
      chartInstanceRef.current?.destroy();
    };
  }, [priceHistory, viewMode]);

  useEffect(() => {
    highlightPriceChanges();
  }, [priceHistory, viewMode]);

  const totalPages = Math.ceil(priceHistory.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = currentPage * rowsPerPage;

  const toggleView = () => setViewMode(viewMode === 'chart' ? 'table' : 'chart');

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    highlightPriceChanges();
  };

  return (
    <>
      <button onClick={toggleView} className="btn-small w-fit mx-auto gap-3 min-w-[200px] mt-2 mb-5">
        {viewMode === 'chart' ? 'Switch to Table View' : 'Switch to Chart View'}
      </button>
      {viewMode === 'chart' && (
        <div className="relative w-auto h-auto max-md:h-full">
          <canvas className="dark:bg-white-200 rounded-[30px]" ref={chartRef} />
        </div>
      )}
      {viewMode === 'table' && (
        <div>
          <table className="w-full border-collapse">
            <thead>
              <tr className="dark:text-secondary">
                <th className="bg-gray-200 text-left py-2 px-4 border">Date</th>
                <th className="bg-gray-200 text-left py-2 px-4 border">Price</th>
              </tr>
            </thead>
            <tbody>
              {priceHistory.slice(startIndex, endIndex).map((data, index) => (
                <tr className="dark:bg-secondary" key={index}>
                  <td className="py-2 px-4 border">{data.date.toLocaleString()}</td>
                  <td className="py-2 px-4 border">{data.price} RON</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-center mt-4">
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i}
                onClick={() => handlePageChange(i + 1)}
                className={`px-3 py-1 mx-1 rounded-full ${currentPage === i + 1 ? 'bg-secondary text-white' : 'text-gray-700'}`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

export default PriceTableChart;