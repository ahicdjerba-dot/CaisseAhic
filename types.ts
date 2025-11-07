

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
}

export interface Product {
  id: number;
  name: string;
  categoryId: number;
  price: number;
}

export interface Sale {
  id: number;
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
}