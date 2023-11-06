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
  const chartInstanceRef = useRef<Chart<'line'> | null>(null);

  const [viewMode, setViewMode] = useState<'chart' | 'table'>('table');
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  const filteredPriceHistory = priceHistory.filter((data, index) => {
    if (index === 0 || index === priceHistory.length - 1) {
      return true; // Always include the first and last rows
    }
    return data.price !== priceHistory[index - 1].price;
  });

  useEffect(() => {
    if (chartRef.current && viewMode === 'chart') {
      chartInstanceRef.current = new Chart(chartRef.current, {
        type: 'line',
        data: {
          labels: filteredPriceHistory.map((data) => data.date),
          datasets: [
            {
              label: 'Prețul de-a Lungul Timpului',
              data: filteredPriceHistory.map((data) => data.price),
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
                unit: 'day',
                displayFormats: { day: 'dd MMM yyyy - p' },
              },
              bounds: 'ticks',
              ticks: { maxRotation: 30, minRotation: 30, padding: 12.5, maxTicksLimit: 20 },
            },
            y: { ticks: { callback: (value) => value + ' RON' } },
          },
        },
      });
    }

    return () => {
      chartInstanceRef.current?.destroy();
    };
  }, [filteredPriceHistory, viewMode]);

  const totalPages = Math.ceil(filteredPriceHistory.length / rowsPerPage);

  const toggleView = () => setViewMode(viewMode === 'chart' ? 'table' : 'chart');

  return (
    <>
      <button onClick={toggleView} className="btn-small w-fit mx-auto gap-3 min-w-[200px] mt-2 mb-5 max-sm:hidden">
        {viewMode === 'chart' ? 'Vizualizează Tabelul' : 'Vizualizează Graficul'}
      </button>
      {viewMode === 'chart' && (
        <div className="relative w-auto h-auto max-md:h-full">
          <canvas className="dark:bg-white-200 rounded-[30px]" ref={chartRef} />
        </div>
      )}
      {viewMode === 'table' && (
        <>
          <table className="w-full border-collapse">
            <thead>
              <tr className="dark:text-secondary">
                <th className="bg-gray-200 text-left py-2 px-4 border">Dată</th>
                <th className="bg-gray-200 text-left py-2 px-4 border">Preț</th>
              </tr>
            </thead>
            <tbody>
              {filteredPriceHistory.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage).map((data, index) => {
                const currentPrice = data.price;
                const previousPrice = index > 0 ? filteredPriceHistory[index - 1].price : null;

                const textColorClass =
                  previousPrice !== null
                    ? currentPrice !== previousPrice
                      ? currentPrice > previousPrice
                        ? 'text-red-500'
                        : 'text-green-500'
                      : 'dark:text-white text-black'
                    : 'dark:text-white text-black';

                // Add a class for the first row to make the font bold
                const firstLastRowStyle = (index === 0 || index === filteredPriceHistory.length - 1)  && 'font-bold';
                const firstLastRowText = (index === 0)  ? '- Initial Price' : ((index === filteredPriceHistory.length - 1)) ? '- Last Price' : '';

                return (
                  <tr className={`dark:bg-secondary ${textColorClass} ${firstLastRowStyle}`} key={index}>
                    <td className="py-2 px-4 border">{data.date.toLocaleString()} </td>
                    <td className="py-2 px-4 border">{data.price} RON {firstLastRowText} </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="flex justify-center mt-4">
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i}
                onClick={() => setCurrentPage(i + 1)}
                className={`px-3 py-1 mx-1 rounded-full ${currentPage === i + 1 ? 'bg-secondary text-white' : 'text-gray-700'}`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
};

export default PriceTableChart;