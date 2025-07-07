'use client'

import React, { useState, useEffect } from 'react';
import { 
  ExportColumn, 
  ExportOptions, 
  EXPORT_COLUMNS,
  TrackedProductExportData,
  transformTrackedProductsForExport,
  filterExportData,
  exportToCSV,
  exportToPDF,
  getExportSummary
} from '@/lib/exportUtils';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: any[];
  title?: string;
}

export function ExportModal({ isOpen, onClose, products, title = 'Exportă Produse Urmărite' }: ExportModalProps) {
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    columns: [...EXPORT_COLUMNS],
    format: 'csv',
    filename: 'produse-urmarite'
  });

  const [dateRange, setDateRange] = useState<{
    enabled: boolean;
    start: string;
    end: string;
  }>({
    enabled: false,
    start: '',
    end: ''
  });

  const [isExporting, setIsExporting] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);

  // Transform and preview data when options change
  useEffect(() => {
    if (products.length > 0) {
      const transformedData = transformTrackedProductsForExport(products);
      
      const options: ExportOptions = {
        ...exportOptions,
        dateRange: dateRange.enabled && dateRange.start && dateRange.end ? {
          start: new Date(dateRange.start),
          end: new Date(dateRange.end)
        } : undefined
      };

      const filteredData = filterExportData(transformedData, options);
      setPreviewData(filteredData.slice(0, 5)); // Show first 5 rows as preview
    }
  }, [products, exportOptions, dateRange]);

  const handleColumnToggle = (columnKey: string) => {
    setExportOptions(prev => ({
      ...prev,
      columns: prev.columns.map(col => 
        col.key === columnKey ? { ...col, selected: !col.selected } : col
      )
    }));
  };

  const handleSelectAllColumns = () => {
    const allSelected = exportOptions.columns.every(col => col.selected);
    setExportOptions(prev => ({
      ...prev,
      columns: prev.columns.map(col => ({ ...col, selected: !allSelected }))
    }));
  };

  const handleExport = async () => {
    if (exportOptions.columns.filter(col => col.selected).length === 0) {
      alert('Te rog selectează cel puțin o coloană pentru export.');
      return;
    }

    setIsExporting(true);
    
    try {
      const transformedData = transformTrackedProductsForExport(products);
      
      const options: ExportOptions = {
        ...exportOptions,
        dateRange: dateRange.enabled && dateRange.start && dateRange.end ? {
          start: new Date(dateRange.start),
          end: new Date(dateRange.end)
        } : undefined
      };

      const filteredData = filterExportData(transformedData, options);
      
      if (filteredData.length === 0) {
        alert('Nu există date pentru export cu aceste criterii.');
        return;
      }

      if (exportOptions.format === 'csv') {
        exportToCSV(filteredData, exportOptions.filename);
      } else {
        await exportToPDF(filteredData, exportOptions.filename, title);
      }
      
      onClose();
    } catch (error) {
      console.error('Export error:', error);
      alert('Eroare la export. Te rog încearcă din nou.');
    } finally {
      setIsExporting(false);
    }
  };

  const summary = products.length > 0 ? getExportSummary(transformTrackedProductsForExport(products)) : null;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Summary Stats */}
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {summary.totalProducts}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Total produse
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {summary.averagePriceChange.toFixed(1)}%
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Schimbare medie
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {summary.outOfStockCount}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Stoc epuizat
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {summary.totalSavings.toFixed(2)} RON
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Economii totale
                </div>
              </div>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-6">
            {/* Export Format and Filename */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Setări Export
              </h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Format Export
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="format"
                      value="csv"
                      checked={exportOptions.format === 'csv'}
                      onChange={(e) => setExportOptions(prev => ({ ...prev, format: e.target.value as 'csv' | 'pdf' }))}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">CSV (Excel)</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="format"
                      value="pdf"
                      checked={exportOptions.format === 'pdf'}
                      onChange={(e) => setExportOptions(prev => ({ ...prev, format: e.target.value as 'csv' | 'pdf' }))}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">PDF</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Numele Fișierului
                </label>
                <input
                  type="text"
                  value={exportOptions.filename}
                  onChange={(e) => setExportOptions(prev => ({ ...prev, filename: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="produse-urmarite"
                />
              </div>

              {/* Date Range */}
              <div>
                <label className="flex items-center mb-2">
                  <input
                    type="checkbox"
                    checked={dateRange.enabled}
                    onChange={(e) => setDateRange(prev => ({ ...prev, enabled: e.target.checked }))}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Filtrează după perioada de urmărire
                  </span>
                </label>
                
                {dateRange.enabled && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                        De la
                      </label>
                      <input
                        type="date"
                        value={dateRange.start}
                        onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                        Până la
                      </label>
                      <input
                        type="date"
                        value={dateRange.end}
                        onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Column Selection */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Coloane Export
                </h3>
                <button
                  onClick={handleSelectAllColumns}
                  className="text-sm text-primary hover:text-primary/80"
                >
                  {exportOptions.columns.every(col => col.selected) ? 'Deselectează tot' : 'Selectează tot'}
                </button>
              </div>
              
              <div className="max-h-60 overflow-y-auto space-y-2 border border-gray-200 dark:border-gray-600 rounded-lg p-3">
                {exportOptions.columns.map((column) => (
                  <label key={column.key} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={column.selected}
                      onChange={() => handleColumnToggle(column.key)}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {column.label}
                    </span>
                  </label>
                ))}
              </div>
              
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {exportOptions.columns.filter(col => col.selected).length} din {exportOptions.columns.length} coloane selectate
              </div>
            </div>
          </div>

          {/* Preview */}
          {previewData.length > 0 && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Previzualizare Export (primele 5 rânduri)
              </h3>
              <div className="overflow-x-auto border border-gray-200 dark:border-gray-600 rounded-lg">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      {Object.keys(previewData[0] || {}).map((key) => (
                        <th key={key} className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                    {previewData.map((row, index) => (
                      <tr key={index} className="bg-white dark:bg-gray-800">
                        {Object.values(row).map((value, valueIndex) => (
                          <td key={valueIndex} className="px-3 py-2 text-gray-900 dark:text-white">
                            {String(value)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {products.length > 5 && (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  ... și încă {products.length - 5} rânduri
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md dark:bg-gray-600 dark:text-gray-300 dark:hover:bg-gray-500"
          >
            Anulează
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting || exportOptions.columns.filter(col => col.selected).length === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {isExporting ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Se exportă...
              </>
            ) : (
              <>
                Exportă {exportOptions.format.toUpperCase()}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}