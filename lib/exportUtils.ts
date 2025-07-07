import Papa from 'papaparse';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export interface ExportColumn {
  key: string;
  label: string;
  selected: boolean;
}

export interface ExportOptions {
  columns: ExportColumn[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  format: 'csv' | 'pdf';
  filename?: string;
}

export interface TrackedProductExportData {
  _id: string;
  productTitle: string;
  brand: string;
  category: string;
  currentPrice: number;
  originalPrice: number;
  currency: string;
  priceChangePercentage: number;
  isOutOfStock: boolean;
  url: string;
  addedAt: Date;
  lastUpdated: Date;
  alertSettings: string;
  userNotes?: string;
  personalRating?: number;
  trackingReason: string;
  priceHistory: Array<{ price: number; date: Date }>;
}

// Available columns for export
export const EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'productTitle', label: 'Numele Produsului', selected: true },
  { key: 'brand', label: 'Brand', selected: true },
  { key: 'category', label: 'Categorie', selected: true },
  { key: 'currentPrice', label: 'Preț Curent', selected: true },
  { key: 'originalPrice', label: 'Preț Original', selected: false },
  { key: 'currency', label: 'Monedă', selected: true },
  { key: 'priceChangePercentage', label: 'Schimbare Preț (%)', selected: true },
  { key: 'isOutOfStock', label: 'Stoc Epuizat', selected: false },
  { key: 'url', label: 'URL Produs', selected: false },
  { key: 'addedAt', label: 'Adăugat La', selected: true },
  { key: 'lastUpdated', label: 'Actualizat La', selected: true },
  { key: 'alertSettings', label: 'Setări Alerte', selected: false },
  { key: 'userNotes', label: 'Notițe', selected: false },
  { key: 'personalRating', label: 'Rating Personal', selected: false },
  { key: 'trackingReason', label: 'Motiv Urmărire', selected: false }
];

/**
 * Transforms tracked products data for export
 */
export function transformTrackedProductsForExport(products: any[]): TrackedProductExportData[] {
  return products.map(item => ({
    _id: item._id,
    productTitle: item.productId.title,
    brand: item.productId.brand,
    category: item.productId.category,
    currentPrice: item.productId.currentPrice,
    originalPrice: item.productId.originalPrice,
    currency: item.productId.currency,
    priceChangePercentage: item.priceChangePercentage,
    isOutOfStock: item.productId.isOutOfStock,
    url: item.productId.url,
    addedAt: new Date(item.addedAt),
    lastUpdated: new Date(item.productId.lastScrapedAt || item.productId.updatedAt),
    alertSettings: formatAlertSettings(item.alertSettings),
    userNotes: item.userNotes,
    personalRating: item.personalRating,
    trackingReason: item.trackingReason,
    priceHistory: item.productId.priceHistory || []
  }));
}

/**
 * Format alert settings for display
 */
function formatAlertSettings(alertSettings: any): string {
  const alerts = [];
  if (alertSettings.priceDecrease) alerts.push('Scădere preț');
  if (alertSettings.priceIncrease) alerts.push('Creștere preț');
  if (alertSettings.backInStock) alerts.push('Întoarcere în stoc');
  if (alertSettings.threshold) alerts.push(`Prag: ${alertSettings.threshold}`);
  return alerts.join(', ') || 'Fără alerte';
}

/**
 * Filter data based on selected columns and date range
 */
export function filterExportData(
  data: TrackedProductExportData[],
  options: ExportOptions
): Record<string, any>[] {
  let filteredData = data;

  // Filter by date range if specified
  if (options.dateRange) {
    filteredData = data.filter(item => {
      const addedDate = new Date(item.addedAt);
      return addedDate >= options.dateRange!.start && addedDate <= options.dateRange!.end;
    });
  }

  // Select only the specified columns
  const selectedColumns = options.columns.filter(col => col.selected);
  
  return filteredData.map(item => {
    const filteredItem: Record<string, any> = {};
    selectedColumns.forEach(column => {
      let value = (item as any)[column.key];
      
      // Format dates for display
      if (value instanceof Date) {
        value = value.toLocaleDateString('ro-RO') + ' ' + value.toLocaleTimeString('ro-RO');
      }
      
      // Format boolean values
      if (typeof value === 'boolean') {
        value = value ? 'Da' : 'Nu';
      }
      
      // Format numbers with proper decimal places
      if (typeof value === 'number' && (column.key.includes('Price') || column.key.includes('Percentage'))) {
        value = value.toFixed(2);
      }
      
      filteredItem[column.label] = value;
    });
    return filteredItem;
  });
}

/**
 * Export data as CSV
 */
export function exportToCSV(data: Record<string, any>[], filename: string = 'produse-urmarite'): void {
  const csv = Papa.unparse(data, {
    header: true,
    delimiter: ',',
    newline: '\n'
  });

  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

/**
 * Export data as PDF
 */
export async function exportToPDF(
  data: Record<string, any>[], 
  filename: string = 'produse-urmarite',
  title: string = 'Produse Urmărite'
): Promise<void> {
  try {
    // Create a temporary container for the table
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    container.style.width = '210mm'; // A4 width
    container.style.backgroundColor = 'white';
    container.style.padding = '20px';
    container.style.fontFamily = 'Arial, sans-serif';
    
    // Add title
    const titleElement = document.createElement('h1');
    titleElement.textContent = title;
    titleElement.style.textAlign = 'center';
    titleElement.style.marginBottom = '20px';
    titleElement.style.color = '#333';
    container.appendChild(titleElement);
    
    // Add export date
    const dateElement = document.createElement('p');
    dateElement.textContent = `Exportat la: ${new Date().toLocaleDateString('ro-RO')} ${new Date().toLocaleTimeString('ro-RO')}`;
    dateElement.style.textAlign = 'center';
    dateElement.style.marginBottom = '30px';
    dateElement.style.color = '#666';
    container.appendChild(dateElement);
    
    // Create table
    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.fontSize = '12px';
    
    // Create header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    
    if (data.length > 0) {
      Object.keys(data[0]).forEach(key => {
        const th = document.createElement('th');
        th.textContent = key;
        th.style.border = '1px solid #ddd';
        th.style.padding = '8px';
        th.style.backgroundColor = '#f5f5f5';
        th.style.fontWeight = 'bold';
        th.style.textAlign = 'left';
        headerRow.appendChild(th);
      });
    }
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Create body
    const tbody = document.createElement('tbody');
    data.forEach((row, index) => {
      const tr = document.createElement('tr');
      tr.style.backgroundColor = index % 2 === 0 ? '#fff' : '#f9f9f9';
      
      Object.values(row).forEach(value => {
        const td = document.createElement('td');
        td.textContent = String(value || '');
        td.style.border = '1px solid #ddd';
        td.style.padding = '6px';
        td.style.wordWrap = 'break-word';
        tr.appendChild(td);
      });
      
      tbody.appendChild(tr);
    });
    
    table.appendChild(tbody);
    container.appendChild(table);
    
    // Add summary
    const summaryElement = document.createElement('p');
    summaryElement.textContent = `Total produse: ${data.length}`;
    summaryElement.style.marginTop = '20px';
    summaryElement.style.fontWeight = 'bold';
    summaryElement.style.textAlign = 'center';
    container.appendChild(summaryElement);
    
    document.body.appendChild(container);
    
    // Convert to canvas and then to PDF
    const canvas = await html2canvas(container, {
      scale: 1,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff'
    });
    
    document.body.removeChild(container);
    
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    
    const ratio = Math.min(pdfWidth / canvasWidth, pdfHeight / canvasHeight);
    const imgWidth = canvasWidth * ratio;
    const imgHeight = canvasHeight * ratio;
    
    // Center the image
    const x = (pdfWidth - imgWidth) / 2;
    const y = 10;
    
    // Add image to PDF
    pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);
    
    // Save the PDF
    pdf.save(`${filename}-${new Date().toISOString().split('T')[0]}.pdf`);
    
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Eroare la generarea PDF-ului. Te rog încearcă din nou.');
  }
}

/**
 * Get summary statistics for export data
 */
export function getExportSummary(data: TrackedProductExportData[]): {
  totalProducts: number;
  averagePriceChange: number;
  outOfStockCount: number;
  totalSavings: number;
  dateRange: { start: Date; end: Date } | null;
} {
  if (data.length === 0) {
    return {
      totalProducts: 0,
      averagePriceChange: 0,
      outOfStockCount: 0,
      totalSavings: 0,
      dateRange: null
    };
  }

  const totalProducts = data.length;
  const averagePriceChange = data.reduce((sum, item) => sum + item.priceChangePercentage, 0) / totalProducts;
  const outOfStockCount = data.filter(item => item.isOutOfStock).length;
  const totalSavings = data.reduce((sum, item) => {
    return sum + Math.max(0, item.originalPrice - item.currentPrice);
  }, 0);
  
  const dates = data.map(item => new Date(item.addedAt)).sort((a, b) => a.getTime() - b.getTime());
  const dateRange = dates.length > 0 ? {
    start: dates[0],
    end: dates[dates.length - 1]
  } : null;

  return {
    totalProducts,
    averagePriceChange,
    outOfStockCount,
    totalSavings,
    dateRange
  };
}