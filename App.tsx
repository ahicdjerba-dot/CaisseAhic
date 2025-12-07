
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AppData, Table, Category, Product, OrderItem, Sale, Room, Printer } from './types';
import { AdminPanel } from './components/AdminPanel';
import Modal from './components/Modal';
import * as db from './db';

// Mock definition for Capacitor globally to avoid build errors in web preview
declare global {
    interface Window {
        Capacitor?: {
            isNativePlatform: () => boolean;
            Plugins?: {
                ThermalPrinter?: any;
            };
        };
        // Plugin interface mock
        ThermalPrinter?: {
            printFormattedText: (options: {
                type: 'bluetooth' | 'tcp';
                id: string; // MAC address or IP:Port
                text: string;
            }) => Promise<void>;
            printBitmap: (options: {
                type: 'bluetooth' | 'tcp';
                id: string;
                base64: string;
            }) => Promise<void>;
        };
    }
}

const INITIAL_DATA: AppData = {
    rooms: [
        { id: 1, name: "Salle 1" },
        { id: 2, name: "Salle 2" },
        { id: 3, name: "Salle 3" },
    ],
    tables: Array.from({ length: 60 }, (_, i) => ({
        id: i + 1,
        name: `Table ${i + 1}`,
        roomId: i < 20 ? 1 : i < 40 ? 2 : 3,
        status: "free",
        order: [],
        ticketPrinted: false
    })),
    categories: [
        { id: 1, name: "Bières" },
        { id: 2, name: "Vins" }
    ],
    products: [
        { id: 1, name: "Celtia", categoryId: 1, price: 6.00 },
        { id: 2, name: "Celtia Boite", categoryId: 1, price: 6.00 },
        { id: 3, name: "Becks", categoryId: 1, price: 7.00 },
        { id: 4, name: "Becks Boite", categoryId: 1, price: 7.00 },
        { id: 5, name: "Amestel", categoryId: 1, price: 6.00 },
        { id: 6, name: "Heinekein", categoryId: 1, price: 7.00 },
        { id: 7, name: "Stelle", categoryId: 1, price: 8.00 },
        { id: 8, name: "Magon Rosé", categoryId: 2, price: 45.00 },
        { id: 9, name: "Magon Rouge", categoryId: 2, price: 45.00 },
        { id: 10, name: "Magnefique Rosé", categoryId: 2, price: 60.00 },
        { id: 11, name: "Magnefique Rouge", categoryId: 2, price: 60.00 },
        { id: 12, name: "Bouargoub Rosé", categoryId: 2, price: 35.00 },
        { id: 13, name: "Chardonny", categoryId: 2, price: 60.00 },
        { id: 14, name: "Vieux Magon", categoryId: 2, price: 60.00 },
        { id: 15, name: "Gris de Tunisie", categoryId: 2, price: 35.00 }
    ],
    sales: [],
    closingReports: [],
    backgroundImage: null,
    recipientEmail: 'ahic.djerba@gmail.com',
    printers: [],
    defaultPrinterId: null,
    servers: [{ id: 1, name: 'Anis', password: '1234' }],
    saleSequence: 1,
    establishmentName: '',
};

const App: React.FC = () => {
    const [appData, setAppData] = useState<AppData>(INITIAL_DATA);
    const [currentRoomId, setCurrentRoomId] = useState<number | null>(null);
    const [currentTableId, setCurrentTableId] = useState<number | null>(null);
    const [currentCategoryId, setCurrentCategoryId] = useState<number | null>(1);
    const [isAdminPanelOpen, setAdminPanelOpen] = useState(false);
    const [isPayModalOpen, setPayModalOpen] = useState(false);
    const [paymentDiscount, setPaymentDiscount] = useState(0);

    const [adminPassword, setAdminPassword] = useState('12345');
    const SUPER_ADMIN_PASSWORD = '170681';

    // State for login
    const [currentUser, setCurrentUser] = useState<{ type: 'admin' | 'server' | 'super-admin'; name: string } | null>(null);
    const [loginPassword, setLoginPassword] = useState('');
    const [loginError, setLoginError] = useState('');

    // State for quantity change password lock
    const [isQuantityLockModalOpen, setQuantityLockModalOpen] = useState(false);
    const [itemToUpdate, setItemToUpdate] = useState<{ itemId: number; change: 1 | -1 } | null>(null);
    const [quantityAdminPassword, setQuantityAdminPassword] = useState('');
    const [quantityAdminError, setQuantityAdminError] = useState('');

    // State for Quick Bluetooth Add
    const [isBluetoothModalOpen, setBluetoothModalOpen] = useState(false);
    const [bluetoothSearchMessage, setBluetoothSearchMessage] = useState('');
    const [bluetoothPrinterName, setBluetoothPrinterName] = useState('');

    // State for Quick IP Add
    const [isIpModalOpen, setIpModalOpen] = useState(false);
    const [ipPrinterName, setIpPrinterName] = useState('');
    const [ipAddress, setIpAddress] = useState('');
    const [ipPort, setIpPort] = useState('9100');
    
    // State for Category Printer Config Modal
    const [isPrinterConfigModalOpen, setPrinterConfigModalOpen] = useState(false);


    useEffect(() => {
        const loadData = async () => {
            try {
                // Load main data from localStorage safely
                let savedJSON = null;
                try {
                    savedJSON = localStorage.getItem('barPOSData');
                } catch (e) {
                    console.warn("L'accès au LocalStorage est bloqué. Utilisation des données par défaut.");
                }
                
                let loadedData = savedJSON ? JSON.parse(savedJSON) : INITIAL_DATA;
                
                loadedData.backgroundImage = null;

                // Load background image, password, and email from IndexedDB
                // If IndexedDB fails, it will catch and just use defaults
                try {
                    const backgroundImage = await db.get<string>('backgroundImage');
                    const savedPassword = await db.get<string>('adminPassword');
                    const recipientEmail = await db.get<string>('recipientEmail');
                    
                    if (backgroundImage) {
                        loadedData.backgroundImage = backgroundImage;
                    }
                    if (savedPassword) {
                        setAdminPassword(savedPassword);
                    }
                    if (recipientEmail) {
                        loadedData.recipientEmail = recipientEmail;
                    }
                } catch (dbError) {
                    console.warn("Impossible de charger les données IndexedDB (peut-être bloqué par le navigateur).", dbError);
                }

                if (!loadedData.closingReports) {
                    loadedData.closingReports = [];
                }
                if (!loadedData.printers) {
                    loadedData.printers = [];
                }
                if (loadedData.defaultPrinterId === undefined) {
                    loadedData.defaultPrinterId = null;
                }
                 if (!loadedData.servers) {
                    loadedData.servers = [];
                }
                if (loadedData.saleSequence === undefined) {
                    loadedData.saleSequence = 1;
                }
                if (loadedData.establishmentName === undefined) {
                    loadedData.establishmentName = '';
                }
                
                setAppData(loadedData);

            } catch (error) {
                console.error("Erreur critique lors du chargement des données. Retour aux données initiales.", error);
                setAppData(INITIAL_DATA); 
            }
        };
        loadData();
    }, []);

    useEffect(() => {
        if (appData === INITIAL_DATA) {
            return;
        }

        const saveData = async () => {
            try {
                const { backgroundImage, recipientEmail, ...dataToSave } = appData;
                
                try {
                    localStorage.setItem('barPOSData', JSON.stringify(dataToSave));
                } catch (e) {
                    // Silently fail or log warning if storage is full/blocked
                    console.warn("Impossible de sauvegarder dans localStorage.");
                }
                
                try {
                    if (backgroundImage) {
                        await db.set('backgroundImage', backgroundImage);
                    } else {
                        await db.del('backgroundImage');
                    }
                    if (recipientEmail) {
                        await db.set('recipientEmail', recipientEmail);
                    }
                } catch (dbError) {
                     console.warn("Impossible de sauvegarder dans IndexedDB.");
                }

            } catch (error) {
                console.error("Failed to save data", error);
            }
        };

        saveData();
    }, [appData]);

    const currentTable = useMemo(() => appData.tables.find(t => t.id === currentTableId) || null, [appData.tables, currentTableId]);
    
    const dailyTotal = useMemo(() => {
        const today = new Date().toISOString().split('T')[0];
        return appData.sales
            .filter(sale => sale.isFinal && sale.date.startsWith(today) && sale.status !== 'voided')
            .reduce((sum, sale) => sum + sale.total, 0);
    }, [appData.sales]);


    const handleCloseApp = () => {
        if (window.confirm("Êtes-vous sûr de vouloir fermer l'application ?")) {
            window.close();
        }
    };
    
    const addProductToOrder = (product: Product) => {
        if (!currentTable) {
            alert("Veuillez d'abord sélectionner une table");
            return;
        }

        setAppData(prevData => {
            const newTables = prevData.tables.map(table => {
                if (table.id === currentTableId) {
                    const existingItem = table.order.find(item => item.id === product.id);
                    let newOrder;
                    if (existingItem) {
                        newOrder = table.order.map(item =>
                            item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
                        );
                    } else {
                        newOrder = [...table.order, { ...product, quantity: 1 }];
                    }
                    return { ...table, order: newOrder, status: 'occupied' as 'occupied' };
                }
                return table;
            });
            return { ...prevData, tables: newTables };
        });
    };
    
    const _performQuantityUpdate = (itemId: number, change: 1 | -1) => {
        if (!currentTableId) return;

        setAppData(prevData => {
            const newTables = prevData.tables.map(table => {
                if (table.id === currentTableId) {
                    const newOrder = table.order
                        .map(item =>
                            item.id === itemId ? { ...item, quantity: item.quantity + change } : item
                        )
                        .filter(item => item.quantity > 0);

                    // FIX: Explicitly type `newStatus` to prevent it from being widened to `string`.
                    const newStatus: 'free' | 'occupied' = newOrder.length > 0 ? 'occupied' : 'free';
                    const ticketPrinted = newOrder.length > 0 ? table.ticketPrinted : false;
                    return { ...table, order: newOrder, status: newStatus, ticketPrinted };
                }
                return table;
            });
            return { ...prevData, tables: newTables };
        });
    };

    const updateOrderItemQuantity = (itemId: number, change: 1 | -1) => {
        if (!currentTable) return;
        
        if (currentTable.ticketPrinted && change === -1) {
            setItemToUpdate({ itemId, change });
            setQuantityAdminPassword('');
            setQuantityAdminError('');
            setQuantityLockModalOpen(true);
        } else {
            _performQuantityUpdate(itemId, change);
        }
    };
    
     const handleConfirmQuantityUpdate = () => {
        if (!itemToUpdate) return;

        if (quantityAdminPassword !== adminPassword && quantityAdminPassword !== SUPER_ADMIN_PASSWORD) {
            setQuantityAdminError('Mot de passe incorrect.');
            return;
        }

        _performQuantityUpdate(itemToUpdate.itemId, itemToUpdate.change);
        setQuantityLockModalOpen(false);
        setItemToUpdate(null);
    };

    const recordSale = useCallback((options: { 
        isFinal: boolean; 
        paymentMethod?: 'cash' | 'card' | 'credit';
        discountPercentage: number;
    }): Sale | null => {
        if (!currentTable || currentTable.order.length === 0) return null;

        const room = appData.rooms.find(r => r.id === currentTable.roomId);
        if (!room) {
            console.error("Could not find room for the current table.");
            return null;
        }
        
        const subtotal = currentTable.order.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const total = subtotal * (1 - options.discountPercentage / 100);

        const currentSequence = appData.saleSequence;

        const sale: Sale = {
            id: Date.now(),
            dailySequence: currentSequence,
            tableId: currentTable.id,
            tableName: currentTable.name,
            roomName: room.name,
            items: [...currentTable.order],
            subtotal: subtotal,
            discountPercentage: options.discountPercentage,
            total: total,
            date: new Date().toISOString(),
            isFinal: options.isFinal,
            paymentMethod: options.paymentMethod,
            status: 'active',
            serverName: currentUser?.name || 'Inconnu',
        };
        
        setAppData(prev => ({
            ...prev, 
            sales: [...prev.sales, sale],
            saleSequence: prev.saleSequence + 1
        }));
        return sale;

    }, [currentTable, appData.rooms, appData.saleSequence, currentUser]);

    // --- PRINTING LOGIC ---

    // 1. HTML Generator for Browser/Iframe printing
    const generateTicketHTML = (sale: Sale, isReceipt: boolean, establishmentName: string, paymentMethod?: 'cash' | 'card' | 'credit') => {
        const title = isReceipt ? 'Reçu' : 'Ticket';
        const subtotal = sale.subtotal;
        const total = sale.total;
        const establishmentHeader = establishmentName ? `<h1>${establishmentName}</h1>` : '<h1>Bienvenu</h1>';
        
        let methodText = '';
        if (paymentMethod === 'cash') {
            methodText = 'Espèces';
        } else if (paymentMethod === 'card') {
            methodText = 'Carte';
        } else if (paymentMethod === 'credit') {
            methodText = 'Crédit';
        }

        return `
            <html>
                <head>
                    <title>${title} N° ${String(sale.dailySequence).padStart(4, '0')}</title>
                    <style>
                        @page { margin: 0; }
                        body { 
                            font-family: 'Courier New', Courier, monospace; 
                            font-size: 10pt; 
                            width: 100%; 
                            max-width: 80mm; 
                            margin: 0 auto; 
                            padding: 3mm; 
                            box-sizing: border-box; 
                            color: #000; 
                        }
                        .header, .footer { text-align: center; }
                        .header h1 { margin: 0; font-size: 14pt; }
                        .header p { margin: 2px 0; font-size: 9pt; }
                        .items-table { width: 100%; border-collapse: collapse; margin: 10px 0; }
                        .items-table th, .items-table td { padding: 2px 0; font-size: 9pt; }
                        .items-table .item-name { text-align: left; word-break: break-all; }
                        .items-table .item-qty { text-align: center; white-space: nowrap; }
                        .items-table .item-total { text-align: right; white-space: nowrap; }
                        .separator { border-top: 1px dashed black; margin: 5px 0; }
                        .total-section { text-align: right; font-size: 10pt; }
                        .grand-total { font-size: 12pt; font-weight: bold; }
                        .payment-info { text-align: right; font-size: 10pt; margin-top: 5px;}
                        .footer { margin-top: 10px; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        ${establishmentHeader}
                        <p>${title} N° ${String(sale.dailySequence).padStart(4, '0')}</p>
                        <p>Serveur: ${sale.serverName || 'Staff'}</p>
                        <p>Salle: ${sale.roomName}</p>
                        <p>Table: ${sale.tableName}</p>
                        <p>Date: ${new Date(sale.date).toLocaleString('fr-FR')}</p>
                    </div>
                    <div class="separator"></div>
                    <table class="items-table">
                        <thead>
                            <tr>
                                <th class="item-name">Article</th>
                                <th class="item-qty">Qté</th>
                                <th class="item-total">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${sale.items.map(item => `
                                <tr>
                                    <td class="item-name">${item.name}</td>
                                    <td class="item-qty">${item.quantity}</td>
                                    <td class="item-total">${(item.price * item.quantity).toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    <div class="separator"></div>
                    <div class="total-section">
                        ${sale.discountPercentage > 0 ? `
                            <p>SOUS-TOTAL: ${subtotal.toFixed(2)} TND</p>
                            <p>REMISE (${sale.discountPercentage}%): -${(subtotal - total).toFixed(2)} TND</p>
                        ` : ''}
                        <p class="grand-total">TOTAL: ${total.toFixed(2)} TND</p>
                    </div>
                     ${isReceipt && paymentMethod ? `
                        <div class="payment-info">
                            <p>Payé par: ${methodText}</p>
                        </div>
                    ` : ''}
                    <div class="footer">
                       <p>Merci de votre visite !</p>
                    </div>
                    <br><br><br><br>
                </body>
            </html>
        `;
    };
    
    // Generator for Preparation Ticket (Bon de Commande) - HTML
    const generatePreparationHTML = (sale: Sale, itemsOverride?: OrderItem[], printerName?: string) => {
        const itemsToPrint = itemsOverride || sale.items;
        return `
            <html>
                <head>
                    <title>PREPARATION</title>
                    <style>
                        @page { margin: 0; }
                        body { 
                            font-family: 'Courier New', Courier, monospace; 
                            font-size: 12pt; 
                            width: 100%; 
                            max-width: 80mm; 
                            margin: 0 auto; 
                            padding: 3mm; 
                            box-sizing: border-box; 
                            color: #000; 
                        }
                        .header { text-align: center; margin-bottom: 10px; }
                        .header h1 { margin: 0; font-size: 16pt; font-weight: bold; border-bottom: 2px solid black; display: inline-block; padding-bottom: 2px;}
                        .meta { font-size: 12pt; margin-top: 5px; font-weight: bold; }
                        .printer-name { font-size: 14pt; margin-top: 5px; font-weight: bold; text-decoration: underline; }
                        .items-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
                        .items-table th, .items-table td { padding: 5px 0; font-size: 12pt; text-align: left; }
                        .items-table .item-qty { text-align: right; font-weight: bold; font-size: 16pt; }
                        .items-table .item-name { padding-left: 10px; font-weight: bold; font-size: 14pt; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>PREPARATION</h1>
                        ${printerName ? `<div class="printer-name">${printerName}</div>` : ''}
                        <div class="meta">${sale.tableName}</div>
                        <div class="meta">Serveur: ${sale.serverName || 'Staff'}</div>
                        <div class="meta">${new Date(sale.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                    </div>
                    <table class="items-table">
                         <tbody>
                            ${itemsToPrint.map(item => `
                                <tr>
                                    <td class="item-qty">${item.quantity} x</td>
                                    <td class="item-name">${item.name}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    <br><br><br><br>
                </body>
            </html>
        `;
    };

    // 2. Text Generator for Native Thermal Printer (Bluetooth/TCP)
    const generateThermalPrinterText = (sale: Sale, type: 'ticket' | 'preparation', itemsOverride?: OrderItem[], printerName?: string, paymentMethod?: string) => {
        let text = '';
        
        if (type === 'ticket') {
            const estName = appData.establishmentName || 'Bienvenu';
            text += `[C]<b><font size='big'>${estName}</font></b>\n`;
            text += `[C]Ticket N ${String(sale.dailySequence).padStart(4, '0')}\n`;
            text += `[L]Serveur: ${sale.serverName || 'Staff'}\n`;
            text += `[L]Salle: ${sale.roomName}\n`;
            text += `[L]Table: ${sale.tableName}\n`;
            text += `[L]Date: ${new Date(sale.date).toLocaleString('fr-FR')}\n`;
            text += `[C]--------------------------------\n`;
            text += `[L]Article             Qt     Total\n`;
            text += `[C]--------------------------------\n`;
            
            sale.items.forEach(item => {
                const total = (item.price * item.quantity).toFixed(2);
                let name = item.name;
                if (name.length > 18) name = name.substring(0, 18);
                const space1 = ' '.repeat(20 - name.length);
                const qtyStr = String(item.quantity);
                const space2 = ' '.repeat(4 - qtyStr.length);
                
                text += `[L]${name}${space1}${qtyStr}${space2}${total}\n`;
            });
            
            text += `[C]--------------------------------\n`;
             if (sale.discountPercentage > 0) {
                 text += `[R]SOUS-TOTAL: ${sale.subtotal.toFixed(2)} TND\n`;
                 text += `[R]REMISE: -${(sale.subtotal - sale.total).toFixed(2)} TND\n`;
            }
            text += `[R]<b><font size='big'>TOTAL: ${sale.total.toFixed(2)} TND</font></b>\n`;
            if (paymentMethod) {
                let method = paymentMethod === 'cash' ? 'Especes' : paymentMethod === 'card' ? 'Carte' : 'Credit';
                text += `[R]Paye par: ${method}\n`;
            }
            text += `[C]\n[C]Merci de votre visite !\n[L]\n[L]\n[L]\n[L]\n\x1dV\x01`;

        } else if (type === 'preparation') {
            const itemsToPrint = itemsOverride || sale.items;
            text += `[C]<b><font size='big'>PREPARATION</font></b>\n`;
            if (printerName) text += `[C]<b><u>${printerName}</u></b>\n`;
            text += `[C]<b><font size='big'>${sale.tableName}</font></b>\n`;
            text += `[L]Serveur: ${sale.serverName || 'Staff'}\n`;
            text += `[C]${new Date(sale.date).toLocaleTimeString()}\n`;
            text += `[C]--------------------------------\n`;
            
            itemsToPrint.forEach(item => {
                 text += `[L]<b><font size='big'>${item.quantity} x  ${item.name}</font></b>\n`;
            });
            text += `[L]\n[L]\n[L]\n[L]\n\x1dV\x01`;
        }
        
        return text;
    };

    const handlePrintSale = async (
        sale: Sale, 
        type: 'ticket' | 'preparation', 
        targetPrinter?: Printer, 
        itemsOverride?: OrderItem[],
        paymentMethod?: 'cash' | 'card' | 'credit'
    ) => {
        // Déterminer l'imprimante à utiliser
        let printer = targetPrinter;
        
        // Si aucune imprimante cible spécifique n'est passée, chercher celle par défaut
        if (!printer && appData.defaultPrinterId) {
            printer = appData.printers.find(p => p.id === appData.defaultPrinterId);
        }

        // --- MODE ANDROID / CAPACITOR (Native) ---
        if (window.Capacitor?.isNativePlatform()) {
             // 1. Essayer le plugin ThermalPrinter (Bluetooth/TCP Raw)
             const ThermalPrinter = window.ThermalPrinter || window.Capacitor.Plugins?.ThermalPrinter;

             if (ThermalPrinter && printer && (printer.type === 'bluetooth' || printer.type === 'network')) {
                 const formattedText = generateThermalPrinterText(sale, type, itemsOverride, printer.name, paymentMethod);
                 const address = printer.address + (printer.type === 'network' && printer.port ? `:${printer.port}` : '');
                 
                 try {
                     await ThermalPrinter.printFormattedText({
                         type: printer.type === 'network' ? 'tcp' : 'bluetooth',
                         id: address,
                         text: formattedText
                     });
                     return; // Succès natif, on s'arrête là
                 } catch (err) {
                     console.error("Erreur impression native:", err);
                     // Fallback silencieux vers la méthode web si échec
                 }
             }
        }

        // --- MODE WEB / FALLBACK (Iframe/Browser) ---
        // Si on est ici, soit ce n'est pas Android, soit l'impression native a échoué, soit c'est une imprimante système/USB
        let htmlContent = '';
        if (type === 'preparation') {
            htmlContent = generatePreparationHTML(sale, itemsOverride, printer ? printer.name : undefined);
        } else {
            htmlContent = generateTicketHTML(sale, true, appData.establishmentName, paymentMethod);
        }
        
        // Android WebView Interface (si implémentée par le développeur Android)
        if (typeof (window as any).AndroidPrint !== 'undefined') {
             (window as any).AndroidPrint.printDocument(htmlContent);
             return;
        }
        
        // Standard Browser Print
        const printWindow = document.createElement('iframe');
        printWindow.style.position = 'absolute';
        printWindow.style.top = '-9999px';
        printWindow.style.left = '-9999px';
        document.body.appendChild(printWindow);
        
        const doc = printWindow.contentDocument || printWindow.contentWindow?.document;
        if (doc) {
            doc.open();
            doc.write(htmlContent);
            doc.close();
            
            setTimeout(() => {
                printWindow.contentWindow?.focus();
                printWindow.contentWindow?.print();
                setTimeout(() => {
                    document.body.removeChild(printWindow);
                }, 1000);
            }, 500);
        }
    };
    
    // Split preparation ticket by assigned printer (Category Based)
    const printPreparation = (sale: Sale) => {
        // Group items by printerId (from Category)
        const itemsByPrinter: { [key: number]: OrderItem[] } = {};
        const defaultItems: OrderItem[] = [];

        sale.items.forEach(item => {
            const product = appData.products.find(p => p.id === item.id);
            if (product) {
                const category = appData.categories.find(c => c.id === product.categoryId);
                if (category && category.printerId) {
                    if (!itemsByPrinter[category.printerId]) {
                        itemsByPrinter[category.printerId] = [];
                    }
                    itemsByPrinter[category.printerId].push(item);
                } else {
                    defaultItems.push(item);
                }
            } else {
                defaultItems.push(item);
            }
        });

        // Print for each specific printer
        Object.keys(itemsByPrinter).forEach(printerIdStr => {
            const pid = parseInt(printerIdStr);
            const printer = appData.printers.find(p => p.id === pid);
            if (printer) {
                handlePrintSale(sale, 'preparation', printer, itemsByPrinter[pid]);
            } else {
                 // Fallback if printer not found (should be rare)
                 handlePrintSale(sale, 'preparation', undefined, itemsByPrinter[pid]);
            }
        });

        // Print remaining items to default printer (or system)
        if (defaultItems.length > 0) {
             handlePrintSale(sale, 'preparation', undefined, defaultItems);
        }
    };

    const handleConfirmPayment = (paymentMethod: 'cash' | 'card' | 'credit') => {
        const sale = recordSale({ isFinal: true, paymentMethod, discountPercentage: paymentDiscount });
        if (sale) {
            // Imprimer le ticket final
            handlePrintSale(sale, 'ticket', undefined, undefined, paymentMethod);
            
            // Marquer comme imprimé et libérer la table
            setAppData(prev => {
                const newTables = prev.tables.map(table => {
                    if (table.id === currentTableId) {
                        return { ...table, status: 'free' as 'free', order: [], ticketPrinted: false };
                    }
                    return table;
                });
                return { ...prev, tables: newTables };
            });
            setPayModalOpen(false);
            setPaymentDiscount(0);
        }
    };

    const handlePrintTicket = () => {
        const sale = recordSale({ isFinal: false, discountPercentage: 0 }); // Not final, just for printing
        if (sale && currentTableId) {
            handlePrintSale(sale, 'ticket');
            setAppData(prev => ({
                ...prev,
                tables: prev.tables.map(t => t.id === currentTableId ? { ...t, ticketPrinted: true } : t)
            }));
        }
    };

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        
        // Check for Super Admin
        if (loginPassword === SUPER_ADMIN_PASSWORD) {
            setCurrentUser({ type: 'super-admin', name: 'Super Admin' });
            setLoginPassword('');
            setLoginError('');
            setAdminPanelOpen(true); // Direct access for Super Admin
            return;
        }

        // Check Admin
        if (loginPassword === adminPassword) {
            setCurrentUser({ type: 'admin', name: 'Administrateur' });
            setLoginPassword('');
            setLoginError('');
            setAdminPanelOpen(true); // Direct access for Admin
            return;
        }

        // Check Servers
        const server = appData.servers.find(s => s.password === loginPassword);
        if (server) {
            setCurrentUser({ type: 'server', name: server.name });
            setLoginPassword('');
            setLoginError('');
            return;
        }

        setLoginError('Mot de passe incorrect');
    };

    const handleLogout = () => {
        setCurrentUser(null);
        setCurrentRoomId(null);
        setCurrentTableId(null);
        setAdminPanelOpen(false);
    };

    const handleAdminClick = () => {
        if (currentUser?.type === 'admin' || currentUser?.type === 'super-admin') {
            setAdminPanelOpen(true);
        }
    };
    
    // --- QUICK BLUETOOTH ADD LOGIC ---
    const handleQuickBluetoothAdd = async () => {
        if (!(navigator as any).bluetooth) {
            alert("Bluetooth non supporté par ce navigateur.");
            return;
        }
        
        setBluetoothSearchMessage("Recherche...");
        try {
            const device = await (navigator as any).bluetooth.requestDevice({
                acceptAllDevices: true,
                optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb']
            });
            
            if (device) {
                setAppData(prev => {
                    // Check if exists
                    const existingPrinter = prev.printers.find(p => p.address === device.id);
                    if (existingPrinter) {
                         alert(`L'imprimante "${existingPrinter.name}" est maintenant configurée pour les Tickets/Paiements.`);
                        return {
                            ...prev,
                            defaultPrinterId: existingPrinter.id
                        };
                    }
                    
                    const newPrinter: Printer = {
                        id: Date.now(),
                        name: bluetoothPrinterName || device.name || 'Imprimante Caisse',
                        type: 'bluetooth',
                        address: device.id,
                        useEscPos: true,
                        paperWidth: 80, // Default 80mm
                        encoding: 'PC858'
                    };
                    
                    // Always set as default (Ticket/Payment printer)
                    return {
                        ...prev,
                        printers: [...prev.printers, newPrinter],
                        defaultPrinterId: newPrinter.id
                    };
                });
                setBluetoothModalOpen(false);
                setBluetoothPrinterName('');
            }
        } catch (err) {
            setBluetoothSearchMessage("Annulé ou Erreur.");
        }
    };
    
    // --- CATEGORY BLUETOOTH PAIRING ---
    const handleCategoryPrinterPairing = async (category: Category) => {
         if (!(navigator as any).bluetooth) {
            alert("Bluetooth non supporté par ce navigateur.");
            return;
        }

        try {
            const device = await (navigator as any).bluetooth.requestDevice({
                acceptAllDevices: true,
                optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb']
            });
            
            if (device) {
                setAppData(prev => {
                    let printerId = prev.printers.find(p => p.address === device.id)?.id;
                    let newPrinters = [...prev.printers];

                    if (!printerId) {
                        // Create new printer if it doesn't exist
                        const newPrinter: Printer = {
                            id: Date.now(),
                            name: `BT-${category.name}`,
                            type: 'bluetooth',
                            address: device.id,
                            useEscPos: true,
                            paperWidth: 80,
                            encoding: 'PC858'
                        };
                        newPrinters.push(newPrinter);
                        printerId = newPrinter.id;
                    }

                    // Update Category with new printer ID
                    const newCategories = prev.categories.map(cat => 
                        cat.id === category.id ? { ...cat, printerId: printerId } : cat
                    );

                    return {
                        ...prev,
                        printers: newPrinters,
                        categories: newCategories
                    };
                });
                alert(`Imprimante assignée à la catégorie : ${category.name}`);
            }
        } catch (err) {
            console.error("Erreur Bluetooth catégorie", err);
        }
    };

    // --- QUICK IP ADD LOGIC ---
    const handleQuickIpAdd = () => {
        if (!ipPrinterName.trim()) {
            alert("Veuillez entrer un nom pour l'imprimante (ex: Cuisine).");
            return;
        }
        if (!ipAddress.trim()) {
            alert("Veuillez entrer une adresse IP.");
            return;
        }
        
        setAppData(prev => {
             const newPrinter: Printer = {
                id: Date.now(),
                name: ipPrinterName,
                type: 'network',
                address: ipAddress,
                port: parseInt(ipPort) || 9100,
                useEscPos: true,
                paperWidth: 80,
                encoding: 'PC858'
            };

            const isFirst = prev.printers.length === 0;

            return {
                ...prev,
                printers: [...prev.printers, newPrinter],
                defaultPrinterId: isFirst ? newPrinter.id : prev.defaultPrinterId
            };
        });
        
        setIpModalOpen(false);
        setIpPrinterName('');
        setIpAddress('');
        setIpPort('9100');
    };


    if (!currentUser) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-800" style={appData.backgroundImage ? { backgroundImage: `url(${appData.backgroundImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}>
                {appData.backgroundImage && <div className="absolute inset-0 bg-black opacity-50"></div>}
                <div className="bg-white p-8 rounded-lg shadow-xl w-96 relative z-10">
                    <h1 className="text-2xl font-bold text-center mb-6 text-slate-700">Connexion Caisse</h1>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Mot de passe</label>
                            <input
                                type="password"
                                value={loginPassword}
                                onChange={(e) => setLoginPassword(e.target.value)}
                                className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="Entrez votre mot de passe"
                                autoFocus
                            />
                        </div>
                        {loginError && <p className="text-red-500 text-sm text-center">{loginError}</p>}
                        <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition">
                            Se connecter
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    if (isAdminPanelOpen) {
        return (
            <AdminPanel 
                appData={appData} 
                setAppData={setAppData} 
                closePanel={() => setAdminPanelOpen(false)} 
                currentPassword={adminPassword}
                onPasswordChange={async (newPass) => {
                    setAdminPassword(newPass);
                    try { await db.set('adminPassword', newPass); } catch (e) {}
                }}
                onRecipientEmailChange={async (newEmail) => {
                    setAppData(prev => ({ ...prev, recipientEmail: newEmail }));
                    try { await db.set('recipientEmail', newEmail); } catch (e) {}
                }}
                onEstablishmentNameChange={async (newName) => {
                    setAppData(prev => ({ ...prev, establishmentName: newName }));
                }}
                printHTML={(html) => {
                     // Simple bridge for Admin Panel printing (reports)
                     // Usually reports are A4 or generic, so system print is fine
                     const printWindow = document.createElement('iframe');
                     printWindow.style.position = 'absolute';
                     printWindow.style.top = '-9999px';
                     document.body.appendChild(printWindow);
                     const doc = printWindow.contentDocument || printWindow.contentWindow?.document;
                     if(doc) {
                        doc.open();
                        doc.write(html);
                        doc.close();
                        setTimeout(() => {
                            printWindow.contentWindow?.print();
                            setTimeout(() => document.body.removeChild(printWindow), 1000);
                        }, 500);
                     }
                }}
                currentUser={currentUser}
            />
        );
    }

    return (
        <div className="h-screen flex flex-col overflow-hidden bg-slate-100">
            {/* Header */}
            <header className="bg-slate-800 text-white p-4 flex justify-between items-center shadow-md shrink-0">
                <div className="flex items-center gap-4">
                    <h1 className="text-xl font-bold">AHIC</h1>
                     {currentUser.type !== 'server' && (
                        <button onClick={handleAdminClick} className="px-3 py-1 bg-slate-600 rounded hover:bg-slate-500 text-sm">
                            Admin
                        </button>
                    )}
                    <button 
                        onClick={() => setBluetoothModalOpen(true)} 
                        className="p-2 bg-blue-600 rounded hover:bg-blue-500 text-white" 
                        title="Ajout Rapide Bluetooth"
                    >
                        {/* Corrected Bluetooth Icon */}
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m0 0l-4-4m4 4l4-4m0-8L12 4m-4 4l4-4" />
                        </svg>
                    </button>
                    <button 
                        onClick={() => setIpModalOpen(true)} 
                        className="p-2 bg-green-600 rounded hover:bg-green-500 text-white" 
                        title="Ajout Rapide Wifi/IP"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                        </svg>
                    </button>

                    {/* Category Printer Pairing Buttons */}
                    <div className="flex items-center gap-2 overflow-x-auto max-w-[500px] no-scrollbar border-l border-gray-600 pl-4 ml-2">
                        {appData.categories.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => handleCategoryPrinterPairing(cat)}
                                className={`px-2 py-1 text-xs rounded border flex items-center gap-1 whitespace-nowrap transition-colors
                                    ${cat.printerId 
                                        ? 'bg-green-700 border-green-500 hover:bg-green-600 text-white' 
                                        : 'bg-slate-700 border-slate-600 hover:bg-slate-600 text-gray-300'
                                    }`}
                                title={`Configurer imprimante préparation pour ${cat.name}`}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                </svg>
                                {cat.name}
                            </button>
                        ))}
                    </div>

                </div>
                
                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <p className="text-sm font-semibold">{currentUser.name}</p>
                        <p className="text-xs text-gray-400 capitalize">{currentUser.type}</p>
                    </div>
                    <div className="bg-slate-700 px-3 py-1 rounded text-green-400 font-mono font-bold">
                        {dailyTotal.toFixed(2)} TND
                    </div>
                     <button onClick={handleLogout} className="text-sm text-red-300 hover:text-red-100">Déconnexion</button>
                    <button onClick={handleCloseApp} className="text-gray-400 hover:text-white">&times;</button>
                </div>
            </header>

            {/* Main Content */}
            <div className="flex flex-1 overflow-hidden">
                {/* Left: Rooms & Tables */}
                <div className="w-1/3 bg-white border-r border-gray-200 flex flex-col">
                    <div className="flex border-b">
                        {appData.rooms.map(room => (
                            <button
                                key={room.id}
                                onClick={() => { setCurrentRoomId(room.id); setCurrentTableId(null); }}
                                className={`flex-1 py-3 text-sm font-semibold ${currentRoomId === room.id ? 'bg-blue-100 text-blue-700 border-b-2 border-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
                            >
                                {room.name}
                            </button>
                        ))}
                    </div>
                    
                    <div className="flex-1 p-4 overflow-y-auto grid grid-cols-3 gap-3 content-start">
                        {currentRoomId && appData.tables.filter(t => t.roomId === currentRoomId).map(table => (
                            <button
                                key={table.id}
                                onClick={() => setCurrentTableId(table.id)}
                                className={`
                                    p-2 rounded-lg border-2 text-center h-20 flex flex-col justify-center items-center shadow-sm transition
                                    ${currentTableId === table.id ? 'ring-2 ring-offset-2 ring-blue-500' : ''}
                                    ${table.status === 'occupied' 
                                        ? 'bg-red-50 border-red-200 text-red-700' 
                                        : 'bg-green-50 border-green-200 text-green-700'}
                                `}
                            >
                                <span className="font-bold">{table.name}</span>
                                {table.order.length > 0 && (
                                    <span className="text-xs mt-1 font-mono">
                                        {(table.order.reduce((acc, item) => acc + (item.price * item.quantity), 0)).toFixed(1)}
                                    </span>
                                )}
                            </button>
                        ))}
                        {!currentRoomId && <p className="col-span-3 text-center text-gray-500 mt-10">Sélectionnez une salle</p>}
                    </div>
                </div>

                {/* Middle: Order Details */}
                <div className="w-1/3 bg-gray-50 border-r border-gray-200 flex flex-col">
                     <div className="p-3 bg-white border-b shadow-sm flex justify-between items-center">
                        <div>
                             {currentTable ? (
                                <h2 className="text-xl font-bold text-gray-800">{currentTable.name}</h2>
                            ) : (
                                <h2 className="text-sm text-gray-400 italic">Aucune table sélectionnée</h2>
                            )}
                        </div>
                         {currentTable && currentTable.order.length > 0 && (
                             <span className="text-lg font-bold text-blue-600">
                                 {currentTable.order.reduce((sum, i) => sum + (i.price * i.quantity), 0).toFixed(2)} TND
                             </span>
                         )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                        {currentTable && currentTable.order.map((item, idx) => (
                            <div key={idx} className="bg-white p-3 rounded shadow-sm border flex justify-between items-center">
                                <div className="flex-1">
                                    <div className="font-medium">{item.name}</div>
                                    <div className="text-xs text-gray-500">{item.price.toFixed(2)} x {item.quantity}</div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="font-bold">{(item.price * item.quantity).toFixed(2)}</span>
                                    <div className="flex flex-col gap-1">
                                        <button onClick={() => updateOrderItemQuantity(item.id, 1)} className="w-6 h-6 bg-gray-200 rounded flex items-center justify-center hover:bg-gray-300">+</button>
                                        <button onClick={() => updateOrderItemQuantity(item.id, -1)} className="w-6 h-6 bg-gray-200 rounded flex items-center justify-center hover:bg-gray-300">-</button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="p-3 bg-white border-t mt-auto grid grid-cols-2 gap-2">
                        <button 
                            onClick={handlePrintTicket} 
                            disabled={!currentTable || currentTable.order.length === 0}
                            className="bg-gray-700 text-white py-3 rounded shadow hover:bg-gray-600 disabled:opacity-50"
                        >
                            TICKET
                        </button>
                        <button 
                             onClick={() => currentTable && printPreparation(recordSale({isFinal: false, discountPercentage: 0})!)}
                             disabled={!currentTable || currentTable.order.length === 0}
                             className="bg-orange-500 text-white py-3 rounded shadow hover:bg-orange-600 disabled:opacity-50 font-bold"
                        >
                            PRÉPARATION
                        </button>
                        <button 
                            onClick={() => setPayModalOpen(true)}
                            disabled={!currentTable || currentTable.order.length === 0}
                            className="col-span-2 bg-green-600 text-white py-4 rounded shadow hover:bg-green-500 disabled:opacity-50 text-lg font-bold"
                        >
                            PAYER
                        </button>
                    </div>
                </div>

                {/* Right: Products */}
                <div className="w-1/3 bg-white flex flex-col">
                     <div className="flex border-b bg-gray-50">
                        <button 
                             onClick={() => setPrinterConfigModalOpen(true)}
                             className="p-3 text-gray-600 hover:text-blue-600 bg-gray-100 border-r border-gray-200 hover:bg-gray-200 transition-colors"
                             title="Configurer Imprimantes"
                        >
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </button>
                        <div className="flex overflow-x-auto flex-1">
                            {appData.categories.map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => setCurrentCategoryId(cat.id)}
                                    className={`px-4 py-3 whitespace-nowrap font-medium ${currentCategoryId === cat.id ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}
                                >
                                    {cat.name}
                                </button>
                            ))}
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 lg:grid-cols-3 gap-3 content-start">
                        {currentCategoryId && appData.products.filter(p => p.categoryId === currentCategoryId).map(product => (
                            <button
                                key={product.id}
                                onClick={() => addProductToOrder(product)}
                                className="bg-white border rounded-lg p-3 shadow-sm hover:shadow-md hover:border-blue-300 transition text-left flex flex-col h-24 justify-between"
                            >
                                <span className="font-semibold text-sm line-clamp-2">{product.name}</span>
                                <span className="text-blue-600 font-bold self-end">{product.price.toFixed(2)}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Payment Modal */}
            <Modal title={`Paiement - ${currentTable?.name}`} isOpen={isPayModalOpen} onClose={() => setPayModalOpen(false)}>
                <div className="space-y-6">
                    <div className="text-center">
                        <p className="text-gray-600">Total à payer</p>
                        <p className="text-4xl font-bold text-gray-800">
                            {currentTable && (currentTable.order.reduce((sum, i) => sum + (i.price * i.quantity), 0) * (1 - paymentDiscount / 100)).toFixed(2)} TND
                        </p>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Remise (%)</label>
                         <div className="flex gap-2">
                            {[0, 5, 10, 20, 50, 100].map(disc => (
                                <button 
                                    key={disc} 
                                    onClick={() => setPaymentDiscount(disc)}
                                    className={`flex-1 py-2 text-sm border rounded ${paymentDiscount === disc ? 'bg-blue-100 border-blue-500 text-blue-700' : 'bg-white'}`}
                                >
                                    {disc}%
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <button onClick={() => handleConfirmPayment('cash')} className="flex flex-col items-center justify-center p-4 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 text-green-700">
                            <span className="text-2xl mb-1">💵</span>
                            <span className="font-bold">Espèces</span>
                        </button>
                        <button onClick={() => handleConfirmPayment('card')} className="flex flex-col items-center justify-center p-4 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 text-blue-700">
                            <span className="text-2xl mb-1">💳</span>
                            <span className="font-bold">Carte</span>
                        </button>
                        <button onClick={() => handleConfirmPayment('credit')} className="flex flex-col items-center justify-center p-4 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 text-amber-700">
                            <span className="text-2xl mb-1">📝</span>
                            <span className="font-bold">Crédit</span>
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Quantity Lock Modal */}
            <Modal title="Autorisation Requise" isOpen={isQuantityLockModalOpen} onClose={() => { setQuantityLockModalOpen(false); setItemToUpdate(null); }}>
                <div className="space-y-4">
                    <p className="text-gray-600 text-sm">Le ticket a déjà été imprimé. Veuillez entrer le mot de passe administrateur pour modifier la commande.</p>
                    <input
                        type="password"
                        value={quantityAdminPassword}
                        onChange={(e) => { setQuantityAdminPassword(e.target.value); setQuantityAdminError(''); }}
                        className="w-full px-3 py-2 border rounded-md"
                        placeholder="Mot de passe Admin"
                        autoFocus
                    />
                    {quantityAdminError && <p className="text-red-500 text-sm">{quantityAdminError}</p>}
                    <div className="flex justify-end gap-3 mt-4">
                        <button onClick={() => { setQuantityLockModalOpen(false); setItemToUpdate(null); }} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">Annuler</button>
                        <button onClick={handleConfirmQuantityUpdate} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Confirmer</button>
                    </div>
                </div>
            </Modal>

            {/* Quick Bluetooth Modal */}
            <Modal title="Imprimante Ticket & Paiement (Bluetooth)" isOpen={isBluetoothModalOpen} onClose={() => setBluetoothModalOpen(false)}>
                <div className="space-y-4">
                    <p className="text-sm text-gray-600">Connectez l'imprimante Bluetooth qui servira pour les <b>Tickets Clients</b> et les <b>Paiements</b>. Elle sera définie par défaut.</p>
                    <div>
                        <label className="block text-sm font-medium">Nom (Optionnel)</label>
                        <input 
                            type="text" 
                            className="w-full border p-2 rounded" 
                            placeholder="Ex: Caisse, Ticket..." 
                            value={bluetoothPrinterName}
                            onChange={e => setBluetoothPrinterName(e.target.value)}
                        />
                    </div>
                    {bluetoothSearchMessage && (
                        <p className="text-blue-600 text-sm font-medium animate-pulse">{bluetoothSearchMessage}</p>
                    )}
                    <button 
                        onClick={handleQuickBluetoothAdd} 
                        className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700"
                    >
                        Lancer la recherche & Connecter
                    </button>
                </div>
            </Modal>

            {/* Quick IP Modal */}
            <Modal title="Ajout Rapide Imprimante Réseau" isOpen={isIpModalOpen} onClose={() => setIpModalOpen(false)}>
                <div className="space-y-4">
                     <p className="text-sm text-gray-600">Ajoutez une imprimante Wi-Fi/Ethernet rapidement. Elle sera configurée en 80mm ESC/POS.</p>
                     
                     <div>
                        <label className="block text-sm font-medium">Nom</label>
                        <input 
                            type="text" 
                            className="w-full border p-2 rounded" 
                            placeholder="Ex: Cuisine, Bar, Caisse..." 
                            value={ipPrinterName}
                            onChange={e => setIpPrinterName(e.target.value)}
                        />
                    </div>
                    
                    <div className="flex gap-2">
                        <div className="flex-grow">
                             <label className="block text-sm font-medium">Adresse IP</label>
                             <input 
                                type="text" 
                                className="w-full border p-2 rounded" 
                                placeholder="192.168.1.200" 
                                value={ipAddress}
                                onChange={e => setIpAddress(e.target.value)}
                            />
                        </div>
                        <div className="w-24">
                             <label className="block text-sm font-medium">Port</label>
                             <input 
                                type="text" 
                                className="w-full border p-2 rounded" 
                                value={ipPort}
                                onChange={e => setIpPort(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 mt-4">
                        <button onClick={() => setIpModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">Annuler</button>
                        <button onClick={handleQuickIpAdd} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-bold">Sauvegarder</button>
                    </div>
                </div>
            </Modal>
            
            {/* Printer Config Modal */}
            <Modal title="Configuration Imprimantes Catégories" isOpen={isPrinterConfigModalOpen} onClose={() => setPrinterConfigModalOpen(false)}>
                <div className="space-y-4 max-h-[60vh] overflow-y-auto p-1">
                    <p className="text-sm text-gray-600 mb-4">
                        Choisissez sur quelle imprimante envoyer les bons de préparation pour chaque catégorie.
                    </p>
                    {appData.categories.map(cat => (
                        <div key={cat.id} className="flex flex-col gap-1 border-b pb-2 mb-2 last:border-0">
                            <label className="font-semibold text-gray-800">{cat.name}</label>
                            <select 
                                className="border p-2 rounded w-full bg-gray-50"
                                value={cat.printerId || ''}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    const pid = val ? parseInt(val) : undefined;
                                    setAppData(prev => ({
                                        ...prev,
                                        categories: prev.categories.map(c => c.id === cat.id ? { ...c, printerId: pid } : c)
                                    }));
                                }}
                            >
                                <option value="">Imprimante par défaut</option>
                                {appData.printers.map(p => (
                                    <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
                                ))}
                            </select>
                        </div>
                    ))}
                    <div className="flex justify-end pt-2">
                        <button onClick={() => setPrinterConfigModalOpen(false)} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Fermer</button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default App;
