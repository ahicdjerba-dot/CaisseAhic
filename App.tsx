import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AppData, Table, Category, Product, OrderItem, Sale, Room } from './types';
import AdminPanel from './components/AdminPanel';
import Modal from './components/Modal';
import * as db from './db';

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
};

const App: React.FC = () => {
    const [appData, setAppData] = useState<AppData>(INITIAL_DATA);
    const [currentRoomId, setCurrentRoomId] = useState<number | null>(null);
    const [currentTableId, setCurrentTableId] = useState<number | null>(null);
    const [currentCategoryId, setCurrentCategoryId] = useState<number | null>(1);
    const [isAdminPanelOpen, setAdminPanelOpen] = useState(false);
    const [isPayModalOpen, setPayModalOpen] = useState(false);
    const [paymentDiscount, setPaymentDiscount] = useState(0);

    // State for password protection
    const [isPasswordModalOpen, setPasswordModalOpen] = useState(false);
    const [passwordInput, setPasswordInput] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [adminPassword, setAdminPassword] = useState('12345');

    useEffect(() => {
        const loadData = async () => {
            try {
                // Load main data from localStorage
                const savedJSON = localStorage.getItem('barPOSData');
                let loadedData = savedJSON ? JSON.parse(savedJSON) : INITIAL_DATA;
                
                loadedData.backgroundImage = null;

                // Load background image, password, and email from IndexedDB
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

                if (!loadedData.closingReports) {
                    loadedData.closingReports = [];
                }
                
                setAppData(loadedData);

            } catch (error) {
                console.error("Failed to load data", error);
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
                localStorage.setItem('barPOSData', JSON.stringify(dataToSave));
                
                if (backgroundImage) {
                    await db.set('backgroundImage', backgroundImage);
                } else {
                    await db.del('backgroundImage');
                }
                if (recipientEmail) {
                    await db.set('recipientEmail', recipientEmail);
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
            .filter(sale => sale.isFinal && sale.date.startsWith(today))
            .reduce((sum, sale) => sum + sale.total, 0);
    }, [appData.sales]);


    const handleCloseApp = () => {
        // NOTE: window.close() may not work in all browsers/contexts,
        // but it's the standard way to request closing the current window.
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

    const updateOrderItemQuantity = (itemId: number, change: 1 | -1) => {
        if (!currentTable) return;

        setAppData(prevData => {
            const newTables = prevData.tables.map(table => {
                if (table.id === currentTableId) {
                    let newOrder = table.order.map(item =>
                        item.id === itemId ? { ...item, quantity: item.quantity + change } : item
                    ).filter(item => item.quantity > 0);
                    
                    const newStatus = newOrder.length > 0 ? 'occupied' : 'free';
                    const ticketPrinted = newOrder.length > 0 ? table.ticketPrinted : false;
                    return { ...table, order: newOrder, status: newStatus as 'free' | 'occupied', ticketPrinted };
                }
                return table;
            });
            return { ...prevData, tables: newTables };
        });
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

        const sale: Sale = {
            id: Date.now(),
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
        };
        
        setAppData(prev => ({...prev, sales: [...prev.sales, sale]}));
        return sale;

    }, [currentTable, appData.rooms]);

    const generateTicketHTML = (sale: Sale, isReceipt: boolean, paymentMethod?: 'cash' | 'card' | 'credit') => {
        const title = isReceipt ? 'Reçu' : 'Ticket';
        const subtotal = sale.subtotal;
        const total = sale.total;
        
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
                    <title>${title} N° ${sale.id}</title>
                    <style>
                        @page { size: 80mm auto; margin: 0; }
                        body { font-family: 'Courier New', Courier, monospace; font-size: 10pt; width: 80mm; padding: 3mm; box-sizing: border-box; color: #000; }
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
                        <h1>Bienvenu</h1>
                        <p>${title} N° ${String(sale.id).slice(-6)}</p>
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
                </body>
            </html>
        `;
    };
    
    const printHTML = (htmlContent: string) => {
        const printWindow = window.open('', '_blank', 'width=302'); // 80mm ~ 302px
        if (printWindow) {
            printWindow.document.write(htmlContent);
            printWindow.document.close();
            printWindow.focus();
            printWindow.print();
            printWindow.close();
        } else {
            alert("La fenêtre d'impression a été bloquée. Veuillez autoriser les pop-ups pour ce site.");
        }
    };
    
    const printTicket = () => {
        if (!currentTable || currentTable.order.length === 0) {
            alert("Aucun article à imprimer.");
            return;
        }
        
        const sale = recordSale({ isFinal: false, discountPercentage: 0 });
        if (!sale) return;

        setAppData(prevData => ({
            ...prevData,
            tables: prevData.tables.map(t => t.id === currentTableId ? {...t, status: 'occupied', ticketPrinted: true} : t)
        }));
        
        const ticketContent = generateTicketHTML(sale, false);
        printHTML(ticketContent);
    };

    const payTable = () => {
        if (!currentTable || currentTable.order.length === 0) {
            alert("Aucun article à payer.");
            return;
        }
        setPaymentDiscount(0);
        setPayModalOpen(true);
    };
    
    const handleConfirmPayment = (method: 'cash' | 'card' | 'credit') => {
        if (!currentTable) return;
        
        const finalDiscount = method === 'credit' ? 0 : paymentDiscount;

        const sale = recordSale({ 
            isFinal: true, 
            paymentMethod: method,
            discountPercentage: finalDiscount
        });
        if (!sale) return;

        const receiptContent = generateTicketHTML(sale, true, method);
        printHTML(receiptContent);

        setAppData(prevData => ({
            ...prevData,
            tables: prevData.tables.map(t => t.id === currentTableId ? {...t, order: [], status: 'free', ticketPrinted: false} : t)
        }));
        setCurrentTableId(null);
        setPayModalOpen(false);
    };

    const handleBackToRooms = () => {
        setCurrentRoomId(null);
        setCurrentTableId(null);
    };

    const handleYoutubeClick = () => {
        window.open('https://www.youtube.com', '_blank', 'noopener,noreferrer');
    };

    const handleAdminClick = () => {
        setPasswordInput('');
        setPasswordError('');
        setPasswordModalOpen(true);
    };

    const handlePasswordSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (passwordInput === adminPassword) {
            setPasswordModalOpen(false);
            setAdminPanelOpen(true);
        } else {
            setPasswordError('Mot de passe incorrect.');
            setPasswordInput('');
        }
    };

    const handleSetAdminPassword = async (newPassword: string) => {
        try {
            await db.set('adminPassword', newPassword);
            setAdminPassword(newPassword);
        } catch (error) {
            console.error("Failed to save new password", error);
            throw new Error("Could not save password");
        }
    };
    
    const handleSetRecipientEmail = async (newEmail: string) => {
        try {
            await db.set('recipientEmail', newEmail);
            setAppData(prev => ({ ...prev, recipientEmail: newEmail }));
        } catch (error) {
            console.error("Failed to save new email", error);
            throw new Error("Could not save email");
        }
    };

    if (isAdminPanelOpen) {
        return <AdminPanel 
            appData={appData} 
            setAppData={setAppData} 
            closePanel={() => setAdminPanelOpen(false)}
            currentPassword={adminPassword}
            onPasswordChange={handleSetAdminPassword}
            onRecipientEmailChange={handleSetRecipientEmail}
        />;
    }
    
    // Room Selection Screen
    if (currentRoomId === null) {
        const backgroundStyle = appData.backgroundImage ? { backgroundImage: `url(${appData.backgroundImage})` } : {};
        return (
            <div className="h-screen w-screen bg-cover bg-center bg-slate-700 text-white flex flex-col items-center justify-center p-8" style={backgroundStyle}>
                 <div className="absolute inset-0 bg-black bg-opacity-50"></div>
                 <div className="relative z-10 text-center">
                    <button
                        onClick={handleCloseApp}
                        className="absolute top-4 left-4 btn bg-red-600 text-white w-10 h-10 rounded-full flex items-center justify-center text-2xl font-bold hover:bg-red-700 transition shadow-sm"
                        aria-label="Fermer l'application"
                    >
                        &times;
                    </button>
                    <h1 className="text-5xl font-bold mb-4">AHIC Caisse</h1>
                    <p className="text-2xl mb-12">Veuillez sélectionner une salle</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {appData.rooms.map(room => (
                            <button
                                key={room.id}
                                onClick={() => setCurrentRoomId(room.id)}
                                className="bg-slate-800 bg-opacity-70 backdrop-blur-sm p-12 rounded-lg text-3xl font-semibold hover:bg-blue-600 transition-all duration-300 transform hover:scale-105 shadow-lg"
                            >
                                {room.name}
                            </button>
                        ))}
                    </div>
                    <button onClick={handleAdminClick} className="absolute top-4 right-4 btn bg-slate-600 text-white px-4 py-2 rounded-md hover:bg-slate-700 transition shadow-sm">Admin</button>
                 </div>
            </div>
        );
    }
    
    const currentOrderTotal = currentTable?.order.reduce((sum, item) => sum + item.price * item.quantity, 0) || 0;
    
    const currentRoom = appData.rooms.find(r => r.id === currentRoomId);
    const tablesForRoom = appData.tables.filter(t => t.roomId === currentRoomId);
    const discountedTotal = currentOrderTotal * (1 - paymentDiscount / 100);

    return (
        <div className="app-container flex flex-col lg:flex-row h-screen font-sans bg-gray-100 text-slate-800 overflow-hidden">
            {/* Sidebar */}
            <div className="sidebar lg:w-64 w-full lg:h-full shrink-0 bg-slate-800 text-white flex lg:flex-col flex-row shadow-lg">
                <div className="logo p-4 text-2xl font-bold text-center border-b border-slate-700 lg:border-r-0 border-r min-w-[150px]">{currentRoom?.name || 'Le Compte'}</div>
                <div className="tables-list flex lg:flex-col flex-row flex-1 lg:overflow-y-auto overflow-x-auto p-2 space-x-2 lg:space-x-0 lg:space-y-2">
                    {tablesForRoom.map(table => {
                        const tableTotal = table.order.reduce((sum, item) => sum + item.price * item.quantity, 0);
                        return (
                            <button key={table.id} onClick={() => setCurrentTableId(table.id)} className={`table-item p-3 rounded-lg text-left transition-all duration-200 shrink-0 w-32 lg:w-auto ${currentTableId === table.id ? 'bg-blue-500 shadow-md' : 'hover:bg-slate-700'} ${table.status === 'occupied' ? (currentTableId !== table.id ? 'bg-red-600' : 'bg-blue-500') : (currentTableId !== table.id ? 'bg-green-600' : 'bg-blue-500')}`}>
                                <div className="flex justify-between items-center">
                                    <span className="font-bold">{table.name}</span>
                                    <span className="text-xs px-2 py-1 rounded-full bg-black bg-opacity-20">{table.status === 'free' ? 'Libre' : 'Occupée'}</span>
                                </div>
                                {table.status === 'occupied' && tableTotal > 0 && (
                                    <div className="text-sm font-semibold mt-1">
                                        {tableTotal.toFixed(2)} TND
                                    </div>
                                )}
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Main Content */}
            <main className="main-content flex-1 flex flex-col p-2 md:p-4 lg:p-6 overflow-hidden">
                <header className="header flex justify-between items-center mb-4 pb-4 border-b border-gray-200">
                    <div>
                        <h1 className="current-table text-2xl md:text-3xl font-bold text-slate-700">{currentTable?.name || 'Aucune table sélectionnée'}</h1>
                        <p className="text-lg text-slate-500 font-semibold">Ventes du jour: {dailyTotal.toFixed(2)} TND</p>
                    </div>
                    <div className="table-actions flex items-center gap-2">
                         <button onClick={handleBackToRooms} className="btn bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 transition shadow-sm">Salles</button>
                         <button onClick={handleYoutubeClick} className="btn bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition shadow-sm">Youtube</button>
                         <button onClick={printTicket} className="btn bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition shadow-sm disabled:opacity-50" disabled={!currentTable || currentTable.order.length === 0}>Ticket</button>
                        <button onClick={payTable} className="btn bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 transition shadow-sm disabled:opacity-50" disabled={!currentTable || currentTable.order.length === 0}>Payer</button>
                        <button onClick={handleAdminClick} className="btn bg-slate-600 text-white px-4 py-2 rounded-md hover:bg-slate-700 transition shadow-sm">Admin</button>
                        <button
                            onClick={handleCloseApp}
                            className="btn bg-red-600 text-white p-2 rounded-md hover:bg-red-700 transition shadow-sm flex items-center justify-center"
                            aria-label="Fermer l'application"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </header>

                <div className="content-area flex flex-col lg:flex-row flex-1 gap-4 lg:gap-6 overflow-hidden">
                    {/* Categories and Products */}
                    <div className="flex flex-col flex-1 gap-4 overflow-hidden">
                         <div className="categories-panel bg-white p-3 rounded-xl shadow-md shrink-0">
                            <div className="flex space-x-2 overflow-x-auto pb-2">
                            {appData.categories.map(category => (
                                <button key={category.id} onClick={() => setCurrentCategoryId(category.id)} className={`category-item shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-colors duration-200 ${currentCategoryId === category.id ? 'bg-blue-500 text-white' : 'bg-slate-100 hover:bg-slate-200'}`}>
                                    {category.name}
                                </button>
                            ))}
                            </div>
                        </div>

                        <div className="products-panel flex-1 bg-white p-4 rounded-xl shadow-md overflow-y-auto">
                           <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {appData.products.filter(p => p.categoryId === currentCategoryId).map(product => (
                                <button key={product.id} onClick={() => addProductToOrder(product)} className="product-item bg-slate-50 p-4 rounded-lg text-center transition-transform transform hover:-translate-y-1 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50 disabled:transform-none disabled:shadow-none" disabled={!currentTableId}>
                                    <p className="product-name font-bold text-slate-800">{product.name}</p>
                                    <p className="product-price text-sm text-slate-500">{product.price.toFixed(2)} TND</p>
                                </button>
                            ))}
                           </div>
                        </div>
                    </div>
                    
                    {/* Order Panel */}
                    <div className="order-panel w-full lg:w-80 xl:w-96 bg-white rounded-xl shadow-md flex flex-col overflow-hidden shrink-0">
                        <h2 className="order-header p-4 text-xl font-bold border-b border-gray-200">Commande</h2>
                        <div className="order-items flex-1 p-2 overflow-y-auto">
                            {!currentTable || currentTable.order.length === 0 ? (
                                <div className="text-center p-10 text-slate-500">Aucun article</div>
                            ) : (
                                currentTable.order.map(item => (
                                    <div key={item.id} className="order-item flex justify-between items-center p-2 rounded-md hover:bg-slate-50">
                                        <div className="item-details">
                                            <p className="item-name font-semibold">{item.name}</p>
                                            <p className="item-price text-sm text-slate-500">{item.price.toFixed(2)} TND</p>
                                        </div>
                                        <div className="item-quantity flex items-center gap-3">
                                            <button onClick={() => updateOrderItemQuantity(item.id, -1)} className="quantity-btn w-7 h-7 rounded-full bg-slate-200 text-slate-700 hover:bg-red-500 hover:text-white transition-colors">-</button>
                                            <span className="font-bold w-4 text-center">{item.quantity}</span>
                                            <button onClick={() => updateOrderItemQuantity(item.id, 1)} className="quantity-btn w-7 h-7 rounded-full bg-slate-200 text-slate-700 hover:bg-green-500 hover:text-white transition-colors">+</button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="order-total p-4 font-bold text-xl flex justify-between border-t border-gray-200">
                            <span>Total:</span>
                            <span>{currentOrderTotal.toFixed(2)} TND</span>
                        </div>
                    </div>
                </div>
            </main>
            
            <Modal title="Choisir le mode de paiement" isOpen={isPayModalOpen} onClose={() => setPayModalOpen(false)}>
                <div className="text-center">
                    <p className="text-gray-700 mb-2 text-lg">
                        Total à payer pour <strong>{currentTable?.name}</strong>:
                    </p>
                    {paymentDiscount > 0 && (
                        <p className="font-semibold text-xl text-gray-500 line-through">
                            {currentOrderTotal.toFixed(2)} TND
                        </p>
                    )}
                    <p className="font-bold text-4xl mb-6">
                        {discountedTotal.toFixed(2)} TND
                    </p>
                </div>

                <div className="mb-6">
                    <p className="text-center text-gray-600 mb-3 font-semibold">Appliquer une remise (uniquement pour Espèces/Carte):</p>
                    <div className="flex justify-center gap-3">
                        {[0, 10, 20].map(discount => (
                            <button 
                                key={discount}
                                onClick={() => setPaymentDiscount(discount)}
                                className={`px-5 py-2 rounded-lg font-semibold transition ${paymentDiscount === discount ? 'bg-indigo-600 text-white shadow-lg' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                            >
                                {discount > 0 ? `${discount}%` : 'Aucune'}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="mt-6 flex flex-col sm:flex-row justify-center gap-4">
                    <button onClick={() => handleConfirmPayment('cash')} className="w-full px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 text-lg font-semibold transition shadow-md">
                        Espèces
                    </button>
                    <button onClick={() => handleConfirmPayment('card')} className="w-full px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-lg font-semibold transition shadow-md">
                        Carte
                    </button>
                    <button 
                        onClick={() => handleConfirmPayment('credit')} 
                        className="w-full px-6 py-3 bg-amber-500 text-white rounded-lg hover:bg-amber-600 text-lg font-semibold transition shadow-md"
                    >
                        Crédit
                    </button>
                </div>
                <div className="mt-6 flex justify-center">
                    <button onClick={() => setPayModalOpen(false)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-md">
                        Annuler
                    </button>
                </div>
            </Modal>

            <Modal title="Accès Admin" isOpen={isPasswordModalOpen} onClose={() => setPasswordModalOpen(false)}>
                <form onSubmit={handlePasswordSubmit}>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Mot de passe</label>
                            <input 
                                type="password" 
                                value={passwordInput} 
                                onChange={(e) => setPasswordInput(e.target.value)} 
                                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" 
                                autoFocus 
                            />
                        </div>
                        {passwordError && <p className="text-red-500 text-sm">{passwordError}</p>}
                    </div>
                    <div className="mt-6 flex justify-end">
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                            Connexion
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default App;
