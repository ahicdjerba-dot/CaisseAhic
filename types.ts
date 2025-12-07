

export interface OrderItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
}

export interface Room {
  id: number;
  name: string;
}

export interface Table {
  id: number;
  name: string;
  roomId: number;
  status: 'free' | 'occupied';
  order: OrderItem[];
  ticketPrinted: boolean;
}

export interface Category {
  id: number;
  name: string;
  printerId?: number; // ID of the specific printer for this category (e.g., Kitchen, Bar)
}

export interface Product {
  id: number;
  name: string;
  categoryId: number;
  price: number;
}

export interface Sale {
  id: number;
  dailySequence: number;
  tableId: number;
  tableName: string;
  roomName: string;
  items: OrderItem[];
  subtotal: number; // Total before discount
  discountPercentage: number; // e.g., 0, 10, or 20
  total: number; // Final total after discount
  date: string; // ISO string format
  isFinal: boolean;
  paymentMethod?: 'cash' | 'card' | 'credit';
  closingReportId?: number;
  status?: 'active' | 'voided';
  serverName?: string;
}

export interface ClosingReport {
    id: number;
    date: string; // YYYY-MM-DD
    sequence: number;
    salesIds: number[];
    total: number;
    cashTotal: number;
    cardTotal: number;
    creditTotal: number;
    itemsSummary: { [key: string]: { quantity: number; total: number } };
    voidedSalesIds?: number[];
    voidedTotal?: number;
    voidedItemsSummary?: { [key: string]: { quantity: number; total: number } };
}

export type PrinterType = 'system' | 'network' | 'bluetooth' | 'usb';

export interface Printer {
  id: number;
  name: string;
  type: PrinterType;
  address?: string; // For IP or MAC address
  port?: number; // For network printers
  
  // ESC/POS Configuration (Raw Printing like python-escpos)
  useEscPos?: boolean;
  paperWidth?: 58 | 80; // mm
  encoding?: string; // e.g., 'PC858', 'PC437', 'UTF-8'
}

export interface Server {
  id: number;
  name: string;
  password: string;
}

export interface AppData {
  rooms: Room[];
  tables: Table[];
  categories: Category[];
  products: Product[];
  sales: Sale[];
  closingReports: ClosingReport[];
  backgroundImage: string | null;
  recipientEmail: string;
  printers: Printer[];
  defaultPrinterId: number | null;
  servers: Server[];
  saleSequence: number;
  establishmentName: string;
}