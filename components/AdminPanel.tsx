
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { AppData, Product, Category, ClosingReport, Printer, PrinterType, Server, Room, Table, Sale } from '../types';
import Modal from './Modal';

interface AdminPanelProps {
    appData: AppData;
    setAppData: React.Dispatch<React.SetStateAction<AppData>>;
    closePanel: () => void;
    currentPassword?: string;
    onPasswordChange?: (newPassword: string) => Promise<void>;
    onRecipientEmailChange?: (newEmail: string) => Promise<void>;
    onEstablishmentNameChange?: (newName: string) => Promise<void>;
    printHTML: (htmlContent: string) => void;
    currentUser: { type: 'admin' | 'server' | 'super-admin'; name: string } | null;
}

interface DailyReportData {
    items: { [key: string]: { quantity: number; total: number } };
    grandTotal: number;
    cashTotal: number;
    cardTotal: number;
    creditTotal: number;
    salesByServer: { [key: string]: number };
}

interface ZReportData {
    totalSales: number;
    salesByCategory: { [key: string]: number };
    salesByServer: { [key: string]: number };
    count: number;
    monthlyItemsSummary: { [key: string]: { quantity: number; total: number } };
    cashTotal: number;
    cardTotal: number;
    creditTotal: number;
}

type AdminTab = 'products' | 'categories' | 'sales' | 'z-report' | 'settings';

export const AdminPanel: React.FC<AdminPanelProps> = ({ appData, setAppData, closePanel, currentPassword, onPasswordChange, onRecipientEmailChange, onEstablishmentNameChange, printHTML, currentUser }) => {
    const [activeTab, setActiveTab] = useState<AdminTab>('sales');
    
    // Product State
    const [isProductModalOpen, setProductModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [productForm, setProductForm] = useState({ name: '', price: '', categoryId: '', printerId: '' });
    const [productToDelete, setProductToDelete] = useState<Product | null>(null);
    
    // Category State
    const [isCategoryModalOpen, setCategoryModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [categoryForm, setCategoryForm] = useState({ name: '' });
    const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);

    // Printer State
    const [isPrinterModalOpen, setPrinterModalOpen] = useState(false);
    const [editingPrinter, setEditingPrinter] = useState<Printer | null>(null);
    const [printerForm, setPrinterForm] = useState<{
        name: string;
        type: PrinterType;
        address: string;
        port: string;
        useEscPos: boolean;
        paperWidth: string; // Stored as string in form for select
        encoding: string;
    }>({ 
        name: '', 
        type: 'system', 
        address: '', 
        port: '9100',
        useEscPos: false,
        paperWidth: '80',
        encoding: 'PC858'
    });
    const [printerToDelete, setPrinterToDelete] = useState<Printer | null>(null);
    const [isSearchingPrinter, setIsSearchingPrinter] = useState(false);
    const [searchMessage, setSearchMessage] = useState('');
    
    // Network Scan Settings
    const [scanSubnet, setScanSubnet] = useState('192.168.1');
    const [scanPortStart, setScanPortStart] = useState('9100');
    const [scanPortEnd, setScanPortEnd] = useState('9100');
    const [scanTimeout, setScanTimeout] = useState(1000); 
    
    // Server State
    const [isServerModalOpen, setServerModalOpen] = useState(false);
    const [editingServer, setEditingServer] = useState<Server | null>(null);
    const [serverForm, setServerForm] = useState({ name: '', password: '' });
    const [serverToDelete, setServerToDelete] = useState<Server | null>(null);
    
    // Room State
    const [isRoomModalOpen, setRoomModalOpen] = useState(false);
    const [editingRoom, setEditingRoom] = useState<Room | null>(null);
    const [roomForm, setRoomForm] = useState({ name: '' });
    const [roomToDelete, setRoomToDelete] = useState<Room | null>(null);

    // Table State
    const [isTableModalOpen, setTableModalOpen] = useState(false);
    const [editingTable, setEditingTable] = useState<Table | null>(null);
    const [tableForm, setTableForm] = useState({ name: '', roomId: 0 });
    const [tableToDelete, setTableToDelete] = useState<Table | null>(null);


    // Network Scanner State
    const [isScanningNetwork, setIsScanningNetwork] = useState(false);
    const [networkScanMessage, setNetworkScanMessage] = useState('');
    const [foundIpAddresses, setFoundIpAddresses] = useState<string[]>([]);
    const scanAbortController = useRef<AbortController | null>(null);

    const [salesDate, setSalesDate] = useState(new Date().toISOString().split('T')[0]);
    const [zReportMonth, setZReportMonth] = useState(new Date().toISOString().substring(0, 7));
    
    // State for Sales Reset
    const [isResetConfirmModalOpen, setIsResetConfirmModalOpen] = useState(false);
    const [isResetDateSelectModalOpen, setIsResetDateSelectModalOpen] = useState(false);
    const [monthToReset, setMonthToReset] = useState('');
    const [resetMonthYear, setResetMonthYear] = useState({
        month: new Date().getMonth() + 1, // 1-12 for display
        year: new Date().getFullYear(),
    });

    // State for Sale Deletion
    const [saleToVoid, setSaleToVoid] = useState<Sale | null>(null);
    const [isVoidPasswordModalOpen, setVoidPasswordModalOpen] = useState(false);
    const [voidPasswordInput, setVoidPasswordInput] = useState('');
    const [voidPasswordError, setVoidPasswordError] = useState('');


    // State for password change form
    const [passwordChangeForm, setPasswordChangeForm] = useState({ current: '', newPass: '', confirmPass: '' });
    const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' });
    
    // State for establishment name change form
    const [establishmentName, setEstablishmentName] = useState(appData.establishmentName || '');
    const [establishmentNameMessage, setEstablishmentNameMessage] = useState({ type: '', text: '' });


    if (currentUser?.type !== 'admin' && currentUser?.type !== 'super-admin') {
        closePanel();
        return null;
    }

    useEffect(() => {
        if (!editingProduct) return;

        const handler = setTimeout(() => {
            const name = productForm.name.trim();
            const price = parseFloat(productForm.price);
            const categoryId = parseInt(productForm.categoryId, 10);
            const printerId = productForm.printerId ? parseInt(productForm.printerId, 10) : undefined;

            if (
                editingProduct.name === name &&
                editingProduct.price === price &&
                editingProduct.categoryId === categoryId &&
                editingProduct.printerId === printerId
            ) {
                return;
            }

            if (!name || isNaN(price) || price <= 0 || isNaN(categoryId)) {
                return;
            }

            const updatedProduct: Product = {
                id: editingProduct.id,
                name,
                price,
                categoryId,
                printerId
            };

            setAppData(prev => ({
                ...prev,
                products: prev.products.map(p => p.id === editingProduct.id ? updatedProduct : p)
            }));
            
        }, 500);

        return () => {
            clearTimeout(handler);
        };
    }, [productForm, editingProduct, setAppData]);
    
    const downloadTxtFile = (content: string, filename: string) => {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleProductFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setProductForm(prev => ({ ...prev, [name]: value }));
    };

    const openAddProductModal = () => {
        setEditingProduct(null);
        setProductForm({ name: '', price: '', categoryId: appData.categories[0]?.id.toString() || '', printerId: '' });
        setProductModalOpen(true);
    };

    const openEditProductModal = (product: Product) => {
        setEditingProduct(product);
        setProductForm({
            name: product.name,
            price: product.price.toString(),
            categoryId: product.categoryId.toString(),
            printerId: product.printerId ? product.printerId.toString() : ''
        });
        setProductModalOpen(true);
    };

    const handleSaveProduct = () => {
        const { name, price, categoryId, printerId } = productForm;
        if (!name.trim() || !price || !categoryId) {
            alert("Veuillez remplir tous les champs obligatoires.");
            return;
        }

        const newProduct: Product = {
            id: editingProduct ? editingProduct.id : Date.now(),
            name: name.trim(),
            price: parseFloat(price),
            categoryId: parseInt(categoryId),
            printerId: printerId ? parseInt(printerId) : undefined
        };

        if (editingProduct) {
            setAppData(prev => ({
                ...prev,
                products: prev.products.map(p => p.id === editingProduct.id ? newProduct : p)
            }));
        } else {
            setAppData(prev => ({
                ...prev,
                products: [...prev.products, newProduct]
            }));
        }
        setProductModalOpen(false);
    };
    
    const requestDeleteProduct = (product: Product) => {
        setProductToDelete(product);
    };

    const handleConfirmDelete = () => {
        if (!productToDelete) return;
        setAppData(prev => ({
            ...prev,
            products: prev.products.filter(p => p.id !== productToDelete.id)
        }));
        setProductToDelete(null);
    };
    
    // ... (Category, Server, Room, Table, Printer Handlers)
    const openAddCategoryModal = () => {
        setEditingCategory(null);
        setCategoryForm({ name: '' });
        setCategoryModalOpen(true);
    };

    const openEditCategoryModal = (category: Category) => {
        setEditingCategory(category);
        setCategoryForm({ name: category.name });
        setCategoryModalOpen(true);
    };

    const handleSaveCategory = () => {
        const { name } = categoryForm;
        if (!name.trim()) {
            alert("Veuillez entrer un nom de catégorie.");
            return;
        }

        if (editingCategory) {
            setAppData(prev => ({
                ...prev,
                categories: prev.categories.map(c => c.id === editingCategory.id ? { ...c, name: name.trim() } : c)
            }));
        } else {
            const newCategory = {
                id: Date.now(),
                name: name.trim(),
            };
            setAppData(prev => ({
                ...prev,
                categories: [...prev.categories, newCategory]
            }));
        }
        setCategoryModalOpen(false);
    };

    const requestDeleteCategory = (category: Category) => {
        const isCategoryInUse = appData.products.some(p => p.categoryId === category.id);
        if (isCategoryInUse) {
            alert("Impossible de supprimer cette catégorie car elle est utilisée par un ou plusieurs produits. Veuillez d'abord changer la catégorie de ces produits.");
            return;
        }
        setCategoryToDelete(category);
    };

    const handleConfirmDeleteCategory = () => {
        if (!categoryToDelete) return;
        setAppData(prev => ({
            ...prev,
            categories: prev.categories.filter(c => c.id !== categoryToDelete.id)
        }));
        setCategoryToDelete(null);
    };

    // Server Handlers
    const openAddServerModal = () => {
        setEditingServer(null);
        setServerForm({ name: '', password: '' });
        setServerModalOpen(true);
    };

    const openEditServerModal = (server: Server) => {
        setEditingServer(server);
        setServerForm({ name: server.name, password: '' });
        setServerModalOpen(true);
    };

    const handleSaveServer = () => {
        const { name, password } = serverForm;
        const trimmedName = name.trim();

        if (!trimmedName) {
            alert("Veuillez entrer un nom d'utilisateur pour le serveur.");
            return;
        }

        // Uniqueness checks
        const isNameDuplicate = appData.servers.some(
            s => s.name.toLowerCase() === trimmedName.toLowerCase() && s.id !== editingServer?.id
        );
        if (isNameDuplicate) {
            alert("Ce nom de serveur est déjà utilisé. Veuillez en choisir un autre.");
            return;
        }

        if (password) { // Only check password if one is provided
            const isPasswordDuplicate = appData.servers.some(
                s => s.password === password && s.id !== editingServer?.id
            );
            if (isPasswordDuplicate) {
                alert("Ce mot de passe est déjà utilisé par un autre serveur. Veuillez en choisir un autre.");
                return;
            }
        }

        if (editingServer) {
            if (!password && !window.confirm("Le mot de passe est vide. Le mot de passe du serveur ne sera pas changé. Continuer?")) {
                return;
            }
            const updatedServer = { ...editingServer, name: trimmedName };
            if (password) {
                updatedServer.password = password;
            }
            setAppData(prev => ({
                ...prev,
                servers: prev.servers.map(s => s.id === editingServer.id ? updatedServer : s)
            }));
        } else {
            if (!password) {
                alert("Le mot de passe est requis pour un nouveau serveur.");
                return;
            }
            const newServer: Server = {
                id: Date.now(),
                name: trimmedName,
                password,
            };
            setAppData(prev => ({
                ...prev,
                servers: [...prev.servers, newServer]
            }));
        }
        setServerModalOpen(false);
    };

    const requestDeleteServer = (server: Server) => {
        setServerToDelete(server);
    };

    const handleConfirmDeleteServer = () => {
        if (!serverToDelete) return;
        setAppData(prev => ({
            ...prev,
            servers: prev.servers.filter(s => s.id !== serverToDelete.id)
        }));
        setServerToDelete(null);
    };
    
    // Room Handlers
    const openAddRoomModal = () => {
        setEditingRoom(null);
        setRoomForm({ name: '' });
        setRoomModalOpen(true);
    };

    const openEditRoomModal = (room: Room) => {
        setEditingRoom(room);
        setRoomForm({ name: room.name });
        setRoomModalOpen(true);
    };

    const handleSaveRoom = () => {
        const { name } = roomForm;
        const trimmedName = name.trim();
        if (!trimmedName) {
            alert("Veuillez entrer un nom de salle.");
            return;
        }

        const isNameDuplicate = appData.rooms.some(
            r => r.name.toLowerCase() === trimmedName.toLowerCase() && r.id !== editingRoom?.id
        );
        if (isNameDuplicate) {
            alert("Ce nom de salle est déjà utilisé. Veuillez en choisir un autre.");
            return;
        }

        if (editingRoom) {
            setAppData(prev => ({
                ...prev,
                rooms: prev.rooms.map(r => r.id === editingRoom.id ? { ...r, name: trimmedName } : r)
            }));
        } else {
            const newRoom: Room = {
                id: Date.now(),
                name: trimmedName,
            };
            setAppData(prev => ({
                ...prev,
                rooms: [...prev.rooms, newRoom]
            }));
        }
        setRoomModalOpen(false);
    };

    const requestDeleteRoom = (room: Room) => {
        const isRoomInUse = appData.tables.some(t => t.roomId === room.id);
        if (isRoomInUse) {
            alert("Impossible de supprimer cette salle car elle contient des tables. Veuillez d'abord supprimer ou déplacer les tables de cette salle.");
            return;
        }
        setRoomToDelete(room);
    };

    const handleConfirmDeleteRoom = () => {
        if (!roomToDelete) return;
        setAppData(prev => ({
            ...prev,
            rooms: prev.rooms.filter(r => r.id !== roomToDelete.id)
        }));
        setRoomToDelete(null);
    };
    
    // Table Handlers
    const openAddTableModal = (roomId: number) => {
        setEditingTable(null);
        setTableForm({ name: '', roomId });
        setTableModalOpen(true);
    };
    
    const openEditTableModal = (table: Table) => {
        setEditingTable(table);
        setTableForm({ name: table.name, roomId: table.roomId });
        setTableModalOpen(true);
    };
    
    const handleSaveTable = () => {
        const { name, roomId } = tableForm;
        const trimmedName = name.trim();
        if (!trimmedName) {
            alert("Veuillez entrer un nom de table.");
            return;
        }

        const targetRoomId = editingTable ? editingTable.roomId : roomId;
        const isNameDuplicate = appData.tables.some(
            t => t.roomId === targetRoomId && t.name.toLowerCase() === trimmedName.toLowerCase() && t.id !== editingTable?.id
        );
        if (isNameDuplicate) {
            alert(`Une table nommée "${trimmedName}" existe déjà dans cette salle. Veuillez choisir un autre nom.`);
            return;
        }
    
        if (editingTable) {
            const updatedTable = { ...editingTable, name: trimmedName };
            setAppData(prev => ({
                ...prev,
                tables: prev.tables.map(t => t.id === editingTable.id ? updatedTable : t)
            }));
        } else {
            const newTable: Table = {
                id: Date.now(),
                name: trimmedName,
                roomId: roomId,
                status: 'free',
                order: [],
                ticketPrinted: false
            };
            setAppData(prev => ({
                ...prev,
                tables: [...prev.tables, newTable]
            }));
        }
        setTableModalOpen(false);
    };

    const requestDeleteTable = (table: Table) => {
        if (table.status === 'occupied') {
            alert("Impossible de supprimer cette table car elle a une commande en cours.");
            return;
        }
        setTableToDelete(table);
    };
    
    const handleConfirmDeleteTable = () => {
        if (!tableToDelete) return;
        setAppData(prev => ({
            ...prev,
            tables: prev.tables.filter(t => t.id !== tableToDelete.id)
        }));
        setTableToDelete(null);
    };


    // Printer Handlers
    const openAddPrinterModal = () => {
        setEditingPrinter(null);
        setPrinterForm({ 
            name: '', 
            type: 'system', 
            address: '', 
            port: '9100',
            useEscPos: false,
            paperWidth: '80',
            encoding: 'PC858'
        });
        setIsSearchingPrinter(false);
        setSearchMessage('');
        setFoundIpAddresses([]);
        setNetworkScanMessage('');
        // Reset scan settings
        setScanSubnet(localStorage.getItem('scanSubnet') || '192.168.1');
        setScanPortStart('9100');
        setScanPortEnd('9100');
        setScanTimeout(1000);
        
        setPrinterModalOpen(true);
    };

    const openEditPrinterModal = (printer: Printer) => {
        setEditingPrinter(printer);
        setPrinterForm({
            name: printer.name,
            type: printer.type,
            address: printer.address || '',
            port: printer.port?.toString() || '9100',
            useEscPos: printer.useEscPos || false,
            paperWidth: printer.paperWidth?.toString() || '80',
            encoding: printer.encoding || 'PC858'
        });
        setIsSearchingPrinter(false);
        setSearchMessage('');
        setFoundIpAddresses([]);
        setNetworkScanMessage('');
         // Reset scan settings
        setScanSubnet(localStorage.getItem('scanSubnet') || '192.168.1');
        setScanPortStart('9100');
        setScanPortEnd('9100');
        setScanTimeout(1000);

        setPrinterModalOpen(true);
    };

    const handleSavePrinter = () => {
        const { name, type, address, port, useEscPos, paperWidth, encoding } = printerForm;
        if (!name.trim()) {
            alert("Veuillez entrer un nom pour l'imprimante.");
            return;
        }

        const newPrinterData: Omit<Printer, 'id'> = {
            name: name.trim(),
            type,
            address: type === 'network' || type === 'bluetooth' ? address.trim() : undefined,
            port: type === 'network' && port ? parseInt(port, 10) : undefined,
            useEscPos: useEscPos,
            paperWidth: parseInt(paperWidth) as 58 | 80,
            encoding: encoding
        };
        
        if (editingPrinter) {
            setAppData(prev => ({
                ...prev,
                printers: prev.printers.map(p => p.id === editingPrinter.id ? { ...newPrinterData, id: p.id } : p)
            }));
        } else {
            setAppData(prev => ({
                ...prev,
                printers: [...prev.printers, { ...newPrinterData, id: Date.now() }]
            }));
        }
        setPrinterModalOpen(false);
    };
    
    const handleSearchBluetoothPrinter = async () => {
        setIsSearchingPrinter(true);
        setSearchMessage('');

        if (!(navigator as any).bluetooth) {
            setSearchMessage("La recherche Bluetooth n'est pas supportée par ce navigateur ou cet appareil.\nPour Android (Capacitor), assurez-vous que le plugin Bluetooth est actif.");
            setIsSearchingPrinter(false);
            return;
        }

        try {
            setSearchMessage("Tentative de connexion automatique...");
            // Tentative de récupération des appareils déjà autorisés (automatique)
            let device = null;
            if ((navigator as any).bluetooth.getDevices) {
                const devices = await (navigator as any).bluetooth.getDevices();
                if (devices && devices.length > 0) {
                    device = devices[0]; // Prend le premier appareil déjà connu
                    setSearchMessage(`Appareil connu trouvé: ${device.name}. Reconnexion...`);
                }
            }

            if (!device) {
                setSearchMessage("Ouverture de la fenêtre de sélection Bluetooth... Veuillez choisir votre imprimante.");
                device = await (navigator as any).bluetooth.requestDevice({
                    acceptAllDevices: true,
                    // L'option suivante peut aider pour certains périphériques série
                    optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb', 'battery_service']
                });
            }
            
            if (device) {
                setSearchMessage(`Imprimante "${device.name}" sélectionnée ! Vous pouvez sauvegarder.`);
                setPrinterForm(prev => ({
                    ...prev,
                    name: device.name || 'Imprimante BT',
                    address: device.id 
                }));
            }

        } catch (error: any) {
            if (error.name === 'NotFoundError') {
                setSearchMessage("Recherche annulée. Aucune imprimante n'a été sélectionnée.");
            } else if (error.name === 'SecurityError' || error.message?.includes('permissions policy')) {
                 setSearchMessage("ERREUR CRITIQUE: L'accès Bluetooth est bloqué par la politique de sécurité.\n\nSolutions:\n1. Vérifiez que vous êtes en HTTPS.\n2. Si vous êtes dans un iframe/WebView, l'attribut 'allow=\"bluetooth\"' est manquant.\n3. Sur Android/Capacitor, vérifiez le fichier AndroidManifest.xml.");
            } else {
                console.error("Bluetooth device request failed:", error);
                setSearchMessage(`Erreur Bluetooth: ${error.message}`);
            }
        } finally {
            setIsSearchingPrinter(false);
        }
    };
    
    const stopNetworkScan = () => {
        if (scanAbortController.current) {
            scanAbortController.current.abort();
        }
        setIsScanningNetwork(false);
        setNetworkScanMessage('Recherche annulée par l\'utilisateur.');
    };

    const startNetworkScan = async () => {
        setIsScanningNetwork(true);
        setFoundIpAddresses([]);
        
        scanAbortController.current = new AbortController();
        const { signal } = scanAbortController.current;

        const subnet = scanSubnet.trim() || '192.168.1';
         try {
            localStorage.setItem('scanSubnet', subnet);
        } catch (e) {
            // Ignore error
        }

        const timeout = scanTimeout || 1000;
        const pStart = parseInt(scanPortStart) || 9100;
        const pEnd = parseInt(scanPortEnd) || 9100;

        const portsToProbe: number[] = [];
        if (pStart <= pEnd) {
            for (let p = pStart; p <= pEnd; p++) {
                portsToProbe.push(p);
            }
        } else {
            portsToProbe.push(9100);
        }

        // Always check Port 80 (HTTP) for discovery because it's more browser-friendly
        if (!portsToProbe.includes(80)) {
            portsToProbe.unshift(80);
        }

        if (portsToProbe.length * 254 > 3000) {
             if(!confirm(`Attention : Vous allez scanner ${portsToProbe.length} ports sur 254 IPs. Cela peut être long. Continuer ?`)) {
                setIsScanningNetwork(false);
                return;
            }
        }

        setNetworkScanMessage(`Démarrage du scan sur ${subnet}.x... Vérification du WiFi...`);

        const probeIp = (ip: string): Promise<string | null> => {
            return new Promise(async (resolve) => {
                if (signal.aborted) return resolve(null);
                
                for (const port of portsToProbe) {
                    if (signal.aborted) return resolve(null);
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), timeout);
                    
                    try {
                        // Mode no-cors pour éviter les erreurs réseau, on cherche juste si ça répond (même une erreur opaque)
                        await fetch(`http://${ip}:${port}`, { 
                            method: 'GET', 
                            mode: 'no-cors', 
                            signal: controller.signal, 
                            cache: 'no-cache' 
                        });
                        clearTimeout(timeoutId);
                        return resolve(ip);
                    } catch (err: any) {
                        clearTimeout(timeoutId);
                    }
                }
                resolve(null);
            });
        };

        // SCAN PAR LOTS (BATCH) pour éviter de surcharger le navigateur/mobile
        const batchSize = 10; // 10 IPs à la fois
        const totalIps = 254;
        let foundCount = 0;

        for (let i = 1; i <= totalIps; i += batchSize) {
            if (signal.aborted) break;

            const batchPromises: Promise<string | null>[] = [];
            for (let j = 0; j < batchSize && (i + j) <= totalIps; j++) {
                batchPromises.push(probeIp(`${subnet}.${i + j}`));
            }

            const progress = Math.round((i / totalIps) * 100);
            setNetworkScanMessage(`Scan en cours... ${progress}% (${foundCount} trouvé(s)). Assurez-vous que votre appareil est connecté au même Wifi que l'imprimante.`);
            
            const results = await Promise.all(batchPromises);
            results.forEach(res => {
                if (res) {
                    foundCount++;
                    setFoundIpAddresses(prev => [...new Set([...prev, res])].sort((a,b) => parseInt(a.split('.')[3]) - parseInt(b.split('.')[3])));
                }
            });
            
            // Petite pause pour laisser respirer l'UI thread sur mobile
            await new Promise(r => setTimeout(r, 50));
        }
        
        if (!signal.aborted) {
            setNetworkScanMessage(foundCount > 0 ? `Terminé. ${foundCount} appareil(s) trouvé(s).` : 'Terminé. Aucun appareil détecté. Vérifiez la connexion Wifi/Câble.');
        }
        setIsScanningNetwork(false);
        scanAbortController.current = null;
    };

    const handleSearchPrinter = async () => {
        if (printerForm.type === 'bluetooth') {
            await handleSearchBluetoothPrinter();
            return;
        }
        
        if (printerForm.type === 'network') {
            // Triggered by specific button now, but keep this if users click "Chercher" next to dropdown
            await startNetworkScan();
            return;
        }

        setIsSearchingPrinter(true);
        setSearchMessage('');

        setTimeout(() => {
            setIsSearchingPrinter(false);
            let message = "La recherche automatique n'est pas supportée pour ce type d'imprimante dans un navigateur.\n\n";
             switch (printerForm.type) {
                case 'usb':
                    message += "Pour une imprimante USB, connectez-la et installez les pilotes. Ensuite, utilisez l'option 'Imprimante Système' et sélectionnez-la au moment de l'impression.";
                    break;
                case 'system':
                default:
                    message = "L'option 'Imprimante Système' utilise l'imprimante par défaut de votre appareil. Aucune recherche n'est nécessaire.";
                    break;
            }
            setSearchMessage(message);
        }, 1500);
    };

    const requestDeletePrinter = (printer: Printer) => {
        setPrinterToDelete(printer);
    };

    const handleConfirmDeletePrinter = () => {
        if (!printerToDelete) return;
        setAppData(prev => {
            const newPrinters = prev.printers.filter(p => p.id !== printerToDelete.id);
            const newDefaultId = prev.defaultPrinterId === printerToDelete.id ? null : prev.defaultPrinterId;
            return {
                ...prev,
                printers: newPrinters,
                defaultPrinterId: newDefaultId,
            };
        });
        setPrinterToDelete(null);
    };

    const handleSetDefaultPrinter = (printerId: number) => {
        setAppData(prev => ({
            ...prev,
            defaultPrinterId: printerId
        }));
    };
    
    // ... (Existing code for filtering, reporting, rendering remains same until renderProducts) ...
    const filteredSales = useMemo(() => {
        return appData.sales
            .filter(sale => sale.date.startsWith(salesDate) && sale.isFinal)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [appData.sales, salesDate]);

    const unclosedSalesForDay = useMemo(() => {
        return filteredSales.filter(sale => !sale.closingReportId && sale.status !== 'voided');
    }, [filteredSales]);

    const closingsForDay = useMemo(() => {
        return appData.closingReports
            .filter(report => report.date === salesDate)
            .sort((a, b) => a.sequence - b.sequence);
    }, [appData.closingReports, salesDate]);

    const dailyReportData = useMemo((): DailyReportData => {
        const summary: { [key: string]: { quantity: number; total: number } } = {};
        const salesByServer: { [key: string]: number } = {};
        let grandTotal = 0;
        let cashTotal = 0;
        let cardTotal = 0;
        let creditTotal = 0;
        
        const activeSales = filteredSales.filter(s => s.status !== 'voided');

        activeSales.forEach(sale => {
            grandTotal += sale.total;
            if (sale.paymentMethod === 'cash') {
                cashTotal += sale.total;
            } else if (sale.paymentMethod === 'card') {
                cardTotal += sale.total;
            } else if (sale.paymentMethod === 'credit') {
                creditTotal += sale.total;
            }

            const serverName = sale.serverName || 'Inconnu';
            salesByServer[serverName] = (salesByServer[serverName] || 0) + sale.total;

            sale.items.forEach(item => {
                if (!summary[item.name]) {
                    summary[item.name] = { quantity: 0, total: 0 };
                }
                summary[item.name].quantity += item.quantity;
                const itemTotal = item.price * item.quantity;
                summary[item.name].total += itemTotal;
            });
        });
        
        return { items: summary, grandTotal, cashTotal, cardTotal, creditTotal, salesByServer };
    }, [filteredSales]);

    const zReportData = useMemo((): ZReportData => {
        const salesInMonth = appData.sales.filter(sale => sale.date.startsWith(zReportMonth) && sale.isFinal && sale.status !== 'voided');
        const totalSales = salesInMonth.reduce((sum, sale) => sum + sale.total, 0);
        const cashTotal = salesInMonth.filter(s => s.paymentMethod === 'cash').reduce((sum, s) => sum + s.total, 0);
        const cardTotal = salesInMonth.filter(s => s.paymentMethod === 'card').reduce((sum, s) => sum + s.total, 0);
        const creditTotal = salesInMonth.filter(s => s.paymentMethod === 'credit').reduce((sum, s) => sum + s.total, 0);

        const salesByCategory: { [key: string]: number } = {};
        const salesByServer: { [key: string]: number } = {};
        const monthlyItemsSummary: { [key: string]: { quantity: number; total: number } } = {};

        salesInMonth.forEach(sale => {
            const serverName = sale.serverName || 'Inconnu';
            salesByServer[serverName] = (salesByServer[serverName] || 0) + sale.total;

            sale.items.forEach(item => {
                const product = appData.products.find(p => p.id === item.id);
                const category = appData.categories.find(c => c.id === product?.categoryId);
                if (category) {
                    salesByCategory[category.name] = (salesByCategory[category.name] || 0) + item.price * item.quantity;
                }

                if (!monthlyItemsSummary[item.name]) {
                    monthlyItemsSummary[item.name] = { quantity: 0, total: 0 };
                }
                monthlyItemsSummary[item.name].quantity += item.quantity;
                monthlyItemsSummary[item.name].total += item.price * item.quantity;
            });
        });
        
        return { totalSales, salesByCategory, count: salesInMonth.length, monthlyItemsSummary, cashTotal, cardTotal, creditTotal, salesByServer };
    }, [appData.sales, appData.products, appData.categories, zReportMonth]);
    
    // ... (Void, Print Closing, Close Register, Reset logic remains same) ...

    const requestVoidSale = (sale: Sale) => {
        if (sale.closingReportId) {
            alert("Impossible d'annuler un ticket qui a déjà été inclus dans une clôture de caisse.");
            return;
        }
        setSaleToVoid(sale);
        setVoidPasswordInput('');
        setVoidPasswordError('');
        setVoidPasswordModalOpen(true);
    };

    const handleConfirmSaleVoid = () => {
        if (!saleToVoid || !currentPassword) return;

        if (voidPasswordInput !== currentPassword) {
            setVoidPasswordError('Mot de passe incorrect.');
            return;
        }

        setAppData(prev => ({
            ...prev,
            sales: prev.sales.map(s =>
                s.id === saleToVoid.id ? { ...s, status: 'voided' } : s
            )
        }));
        
        setVoidPasswordModalOpen(false);
        setSaleToVoid(null);
    };

    const printClosingReport = (report: ClosingReport) => {
        const voidedSection = (report.voidedTotal && report.voidedTotal > 0) ? `
            <h2 style="margin-top: 30px; border-top: 2px solid #555; padding-top: 20px;">Tickets Annulés</h2>
            <table>
                <thead>
                    <tr>
                        <th>Article</th>
                        <th class="text-center">Quantité</th>
                        <th class="text-right">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.keys(report.voidedItemsSummary!).map((name) => {
                        const data = report.voidedItemsSummary![name];
                        return `
                        <tr>
                            <td>${name}</td>
                            <td class="text-center">${data.quantity}</td>
                            <td class="text-right">${data.total.toFixed(2)} TND</td>
                        </tr>
                    `;
                    }).join('')}
                </tbody>
                <tfoot>
                    <tr class="total-row">
                        <td colspan="2">Total Annulé</td>
                        <td class="text-right">${report.voidedTotal.toFixed(2)} TND</td>
                    </tr>
                </tfoot>
            </table>
        ` : '';

        const printContent = `
            <html>
                <head>
                    <title>Rapport de Clôture N°${report.sequence} - ${report.date}</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 20px; }
                        h1, h2 { text-align: center; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        th { background-color: #f2f2f2; }
                        .total-row { font-weight: bold; background-color: #f9f9f9; }
                        .text-right { text-align: right; }
                        .text-center { text-align: center; }
                    </style>
                </head>
                <body>
                    <h1>Rapport de Clôture N°${report.sequence}</h1>
                    <h2>Date: ${new Date(report.date + 'T00:00:00').toLocaleDateString('fr-FR')}</h2>
                    <h2>Ventes Actives</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>Article</th>
                                <th class="text-center">Quantité</th>
                                <th class="text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${Object.keys(report.itemsSummary).map((name) => {
                                const data = report.itemsSummary[name];
                                return `
                                <tr>
                                    <td>${name}</td>
                                    <td class="text-center">${data.quantity}</td>
                                    <td class="text-right">${data.total.toFixed(2)} TND</td>
                                </tr>
                            `;
                            }).join('')}
                        </tbody>
                        <tfoot>
                            <tr class="total-row">
                                <td colspan="2">Total Général</td>
                                <td class="text-right">${report.total.toFixed(2)} TND</td>
                            </tr>
                            <tr class="total-row">
                                <td colspan="2">Total Espèces</td>
                                <td class="text-right">${report.cashTotal.toFixed(2)} TND</td>
                            </tr>
                            <tr class="total-row">
                                <td colspan="2">Total Carte</td>
                                <td class="text-right">${report.cardTotal.toFixed(2)} TND</td>
                            </tr>
                            <tr class="total-row">
                                <td colspan="2">Total Crédit</td>
                                <td class="text-right">${report.creditTotal.toFixed(2)} TND</td>
                            </tr>
                        </tfoot>
                    </table>
                    ${voidedSection}
                </body>
            </html>
        `;
        printHTML(printContent);
    };

    const handleCloseRegister = () => {
        if (unclosedSalesForDay.length === 0) {
            alert("Aucune nouvelle vente à clôturer.");
            return;
        }

        const summary: { [key: string]: { quantity: number; total: number } } = {};
        let grandTotal = 0;
        let cashTotal = 0;
        let cardTotal = 0;
        let creditTotal = 0;
        const salesIdsToClose = unclosedSalesForDay.map(s => s.id);

        unclosedSalesForDay.forEach(sale => {
            grandTotal += sale.total;
            if (sale.paymentMethod === 'cash') cashTotal += sale.total;
            else if (sale.paymentMethod === 'card') cardTotal += sale.total;
            else if (sale.paymentMethod === 'credit') creditTotal += sale.total;

            sale.items.forEach(item => {
                if (!summary[item.name]) {
                    summary[item.name] = { quantity: 0, total: 0 };
                }
                summary[item.name].quantity += item.quantity;
                summary[item.name].total += item.price * item.quantity;
            });
        });
        
        const voidedSalesForDay = filteredSales.filter(s => s.status === 'voided' && !s.closingReportId);
        const voidedItemsSummary: { [key: string]: { quantity: number; total: number } } = {};
        let voidedTotal = 0;
        const voidedSalesIdsToClose = voidedSalesForDay.map(s => s.id);

        voidedSalesForDay.forEach(sale => {
            voidedTotal += sale.total;
            sale.items.forEach(item => {
                if (!voidedItemsSummary[item.name]) {
                    voidedItemsSummary[item.name] = { quantity: 0, total: 0 };
                }
                voidedItemsSummary[item.name].quantity += item.quantity;
                voidedItemsSummary[item.name].total += item.price * item.quantity;
            });
        });


        const newClosingReport: ClosingReport = {
            id: Date.now(),
            date: salesDate,
            sequence: closingsForDay.length + 1,
            salesIds: salesIdsToClose,
            total: grandTotal,
            cashTotal,
            cardTotal,
            creditTotal,
            itemsSummary: summary,
            voidedSalesIds: voidedSalesIdsToClose,
            voidedTotal: voidedTotal,
            voidedItemsSummary: voidedItemsSummary
        };

        printClosingReport(newClosingReport);
        // sendClosingReportByEmail(newClosingReport); // Disabled as per user request

        setAppData(prev => {
            const saleIdsToUpdate = [...salesIdsToClose, ...voidedSalesIdsToClose];
            const updatedSales = prev.sales.map(sale => {
                if (saleIdsToUpdate.includes(sale.id)) {
                    return { ...sale, closingReportId: newClosingReport.id };
                }
                return sale;
            });

            return {
                ...prev,
                sales: updatedSales,
                closingReports: [...prev.closingReports, newClosingReport],
                saleSequence: 1,
            };
        });
    };
    
    const handleOpenResetModal = () => {
        const now = new Date();
        setResetMonthYear({ month: now.getMonth() + 1, year: now.getFullYear() });
        setIsResetDateSelectModalOpen(true);
    };

    const handleConfirmDateSelection = () => {
        const { month, year } = resetMonthYear;
        const monthString = month.toString().padStart(2, '0');
        const formattedDate = `${year}-${monthString}`;
        
        const salesInMonth = appData.sales.filter(sale => sale.date.startsWith(formattedDate) && sale.isFinal);
        if (salesInMonth.length === 0) {
            alert(`Aucune vente à réinitialiser pour ${new Date(formattedDate + '-02').toLocaleString('fr-FR', { month: 'long', year: 'numeric' })}.`);
            return;
        }

        setMonthToReset(formattedDate);
        setIsResetDateSelectModalOpen(false);
        setIsResetConfirmModalOpen(true);
    };

    const handleResetMonthlySales = () => {
        if (!monthToReset) {
            console.error("Aucun mois n'a été sélectionné pour la réinitialisation.");
            setIsResetConfirmModalOpen(false);
            return;
        }

        setAppData(prev => {
            const salesToKeep = prev.sales.filter(s => !s.date.startsWith(monthToReset));
            const salesToRemove = prev.sales.filter(s => s.date.startsWith(monthToReset));
            
            const closingReportIdsToRemove = new Set(salesToRemove.map(s => s.closingReportId).filter(Boolean));
            
            const closingReportsToKeep = prev.closingReports.filter(r => !closingReportIdsToRemove.has(r.id));

            return {
                ...prev,
                sales: salesToKeep,
                closingReports: closingReportsToKeep,
            };
        });

        setIsResetConfirmModalOpen(false);
        alert(`Les ventes pour ${new Date(monthToReset + '-02').toLocaleString('fr-FR', { month: 'long', year: 'numeric' })} ont été réinitialisées.`);
        setMonthToReset('');
    };

    const handlePrintSales = () => {
        const printContent = `
            <html>
                <head>
                    <title>Rapport des Ventes - ${salesDate}</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 20px; }
                        h1 { text-align: center; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        th { background-color: #f2f2f2; }
                        .total-row { font-weight: bold; background-color: #f9f9f9; }
                        .text-right { text-align: right; }
                        .text-center { text-align: center; }
                    </style>
                </head>
                <body>
                    <h1>Rapport des Ventes du ${new Date(salesDate + 'T00:00:00').toLocaleDateString('fr-FR')}</h1>
                    
                    <h3>Ventes par Serveur</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>Serveur</th>
                                <th class="text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${Object.entries(dailyReportData.salesByServer).map(([server, total]) => `
                                <tr>
                                    <td>${server}</td>
                                    <td class="text-right">${(total as number).toFixed(2)} TND</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>

                    <h3>Détails par Article</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>Article</th>
                                <th class="text-center">Quantité</th>
                                <th class="text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${Object.keys(dailyReportData.items).map((name) => {
                                const data = dailyReportData.items[name];
                                return `
                                <tr>
                                    <td>${name}</td>
                                    <td class="text-center">${data.quantity}</td>
                                    <td class="text-right">${data.total.toFixed(2)} TND</td>
                                </tr>
                            `;
                            }).join('')}
                        </tbody>
                        <tfoot>
                            <tr class="total-row">
                                <td colspan="2">Total Général</td>
                                <td class="text-right">${dailyReportData.grandTotal.toFixed(2)} TND</td>
                            </tr>
                             <tr class="total-row">
                                <td colspan="2">Total Espèces</td>
                                <td class="text-right">${dailyReportData.cashTotal.toFixed(2)} TND</td>
                            </tr>
                             <tr class="total-row">
                                <td colspan="2">Total Carte</td>
                                <td class="text-right">${dailyReportData.cardTotal.toFixed(2)} TND</td>
                            </tr>
                             <tr class="total-row">
                                <td colspan="2">Total Crédit</td>
                                <td class="text-right">${dailyReportData.creditTotal.toFixed(2)} TND</td>
                            </tr>
                        </tfoot>
                    </table>
                </body>
            </html>
        `;
        printHTML(printContent);
    };
    
    // ... (ZReport export/print, background, password, establishment name handlers same) ...
     const handleExportZReportTxt = () => {
        const reportMonth = new Date(zReportMonth + '-02').toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
        let content = `Rapport Z - ${reportMonth}\n\n`;
        
        content += '-------------------------------------------------------\n';
        content += 'RÉSUMÉ GLOBAL\n';
        content += '-------------------------------------------------------\n';
        content += `Mois: ${reportMonth}\n`;
        content += `Nombre total de transactions: ${zReportData.count}\n`;
        content += `Chiffre d'affaires total: ${zReportData.totalSales.toFixed(2)} TND\n\n`;
        
        content += '-------------------------------------------------------\n';
        content += 'VENTES PAR SERVEUR\n';
        content += '-------------------------------------------------------\n';
        if (Object.keys(zReportData.salesByServer).length > 0) {
            Object.keys(zReportData.salesByServer).forEach((server) => {
                const total = zReportData.salesByServer[server];
                content += `${server}: ${total.toFixed(2)} TND\n`;
            });
        } else {
            content += 'Aucune vente.\n';
        }
        content += '\n';

        content += '-------------------------------------------------------\n';
        content += 'VENTES PAR MODE DE PAIEMENT\n';
        content += '-------------------------------------------------------\n';
        content += `Espèces: ${zReportData.cashTotal.toFixed(2)} TND\n`;
        content += `Carte: ${zReportData.cardTotal.toFixed(2)} TND\n`;
        content += `Crédit: ${zReportData.creditTotal.toFixed(2)} TND\n\n`;
        
        content += '-------------------------------------------------------\n';
        content += 'VENTES PAR CATÉGORIE\n';
        content += '-------------------------------------------------------\n';
        if (Object.keys(zReportData.salesByCategory).length > 0) {
            Object.keys(zReportData.salesByCategory).forEach((category) => {
                const total = zReportData.salesByCategory[category];
                content += `${category}: ${total.toFixed(2)} TND\n`;
            });
        } else {
            content += 'Aucune vente.\n';
        }
        content += '\n';

        content += '-------------------------------------------------------\n';
        content += 'DÉTAIL DES ARTICLES VENDUS\n';
        content += '-------------------------------------------------------\n';
        content += 'Article'.padEnd(30) + 'Quantité'.padStart(10) + 'Total'.padStart(15) + '\n';
        content += '-------------------------------------------------------\n';

        if (Object.keys(zReportData.monthlyItemsSummary).length > 0) {
            Object.keys(zReportData.monthlyItemsSummary).forEach((name) => {
                const data = zReportData.monthlyItemsSummary[name];
                const line = 
                    name.padEnd(30) + 
                    data.quantity.toString().padStart(10) + 
                    `${data.total.toFixed(2)} TND`.padStart(15) + '\n';
                content += line;
            });
        } else {
            content += 'Aucun article vendu ce mois-ci.\n';
        }
        content += '-------------------------------------------------------\n';

        downloadTxtFile(content, `rapport_z_${zReportMonth}.txt`);
    };

    const handlePrintZReport = () => {
        const printContent = `
             <html>
                <head>
                    <title>Rapport Z - ${zReportMonth}</title>
                     <style>
                        body { font-family: Arial, sans-serif; margin: 20px; }
                        h1, h2, h3 { text-align: center; }
                        .summary { border: 1px solid #ccc; padding: 15px; margin-bottom: 20px; border-radius: 5px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        th { background-color: #f2f2f2; }
                        .total-row { font-weight: bold; }
                        .text-right { text-align: right; }
                        .text-center { text-align: center; }
                        ul { list-style-position: inside; padding-left: 0; }
                    </style>
                </head>
                <body>
                    <h1>Rapport Z</h1>
                    <h2>${new Date(zReportMonth + '-02').toLocaleString('fr-FR', { month: 'long', year: 'numeric' })}</h2>
                    
                    <div class="summary">
                        <p><strong>Nombre total de transactions:</strong> ${zReportData.count}</p>
                        <p><strong>Chiffre d'affaires total:</strong> ${zReportData.totalSales.toFixed(2)} TND</p>
                        
                        <h3>Ventes par Serveur:</h3>
                         <ul>
                            ${Object.keys(zReportData.salesByServer).length > 0 ? Object.keys(zReportData.salesByServer).map((server) => {
                                const total = zReportData.salesByServer[server];
                                return `<li>${server}: ${total.toFixed(2)} TND</li>`
                            }).join('') : '<li>Aucune vente.</li>'}
                        </ul>

                        <h3>Ventes par catégorie:</h3>
                        <ul>
                            ${Object.keys(zReportData.salesByCategory).length > 0 ? Object.keys(zReportData.salesByCategory).map((category) => {
                                const total = zReportData.salesByCategory[category];
                                return `<li>${category}: ${total.toFixed(2)} TND</li>`
                            }).join('') : '<li>Aucune vente.</li>'}
                        </ul>
                         <h3>Ventes par mode de paiement:</h3>
                        <ul>
                            <li>Espèces: ${zReportData.cashTotal.toFixed(2)} TND</li>
                            <li>Carte: ${zReportData.cardTotal.toFixed(2)} TND</li>
                            <li>Crédit: ${zReportData.creditTotal.toFixed(2)} TND</li>
                        </ul>
                    </div>
    
                    <h3>Détail des articles vendus</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>Article</th>
                                <th class="text-center">Quantité</th>
                                <th class="text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${Object.keys(zReportData.monthlyItemsSummary).map(name => {
                                const data = zReportData.monthlyItemsSummary[name];
                                return `
                                 <tr>
                                    <td>${name}</td>
                                    <td class="text-center">${data.quantity}</td>
                                    <td class="text-right">${data.total.toFixed(2)} TND</td>
                                </tr>
                            `}).join('')}
                        </tbody>
                    </table>
                </body>
            </html>
        `;
        printHTML(printContent);
    };
    
    const handleBackgroundImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setAppData(prev => ({
                    ...prev,
                    backgroundImage: reader.result as string,
                }));
            };
            reader.readAsDataURL(file);
        }
    };

    const removeBackgroundImage = () => {
        setAppData(prev => ({
            ...prev,
            backgroundImage: null,
        }));
    };
    
    const handlePasswordFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setPasswordChangeForm(prev => ({ ...prev, [name]: value }));
        setPasswordMessage({ type: '', text: '' });
    };

    const handleSubmitNewPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setPasswordMessage({ type: '', text: '' });

        if (passwordChangeForm.current !== currentPassword) {
            setPasswordMessage({ type: 'error', text: 'Le mot de passe actuel est incorrect.' });
            return;
        }
        if (!passwordChangeForm.newPass || passwordChangeForm.newPass.length < 4) {
            setPasswordMessage({ type: 'error', text: 'Le nouveau mot de passe doit contenir au moins 4 caractères.' });
            return;
        }
        if (passwordChangeForm.newPass !== passwordChangeForm.confirmPass) {
            setPasswordMessage({ type: 'error', text: 'Les nouveaux mots de passe ne correspondent pas.' });
            return;
        }

        if (onPasswordChange) {
            try {
                await onPasswordChange(passwordChangeForm.newPass);
                setPasswordMessage({ type: 'success', text: 'Mot de passe changé avec succès !' });
                setPasswordChangeForm({ current: '', newPass: '', confirmPass: '' });
            } catch (error) {
                 setPasswordMessage({ type: 'error', text: 'Erreur lors de la sauvegarde de mot de passe.' });
            }
        }
    };
    
    const handleSubmitEstablishmentName = async (e: React.FormEvent) => {
        e.preventDefault();
        setEstablishmentNameMessage({ type: '', text: '' });

        if (onEstablishmentNameChange) {
            try {
                // We call the handler with the current state value
                await onEstablishmentNameChange(establishmentName);
                setEstablishmentNameMessage({ type: 'success', text: 'Nom de l\'établissement mis à jour avec succès !' });
            } catch (error) {
                setEstablishmentNameMessage({ type: 'error', text: 'Erreur lors de la sauvegarde du nom.' });
            }
        }
    };

    const handleEstablishmentNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setEstablishmentName(e.target.value);
        setEstablishmentNameMessage({ type: '', text: '' });
    };


    const renderProducts = () => (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">Gestion des Articles</h3>
                <button onClick={openAddProductModal} className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600">Ajouter un produit</button>
            </div>
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="grid grid-cols-5 font-bold p-3 bg-gray-50 border-b">
                    <div>Nom</div>
                    <div>Catégorie</div>
                    <div>Prix</div>
                    <div>Imprimante</div>
                    <div>Actions</div>
                </div>
                <div className="divide-y divide-gray-200 max-h-[60vh] overflow-y-auto">
                {appData.products.map(product => {
                    const category = appData.categories.find(c => c.id === product.categoryId);
                    const printer = appData.printers.find(p => p.id === product.printerId);
                    return (
                        <div key={product.id} className="grid grid-cols-5 p-3 items-center">
                            <div>{product.name}</div>
                            <div>{category?.name || 'N/A'}</div>
                            <div>{product.price.toFixed(2)} TND</div>
                            <div className="text-sm text-gray-600 truncate px-1">{printer ? printer.name : 'Par Défaut'}</div>
                            <div className="flex gap-2">
                                <button onClick={() => openEditProductModal(product)} className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600">Modifier</button>
                                <button onClick={() => requestDeleteProduct(product)} className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600">Supprimer</button>
                            </div>
                        </div>
                    );
                })}
                </div>
            </div>
        </div>
    );
    
    const renderCategories = () => (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">Gestion des Catégories</h3>
                <button onClick={openAddCategoryModal} className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600">Ajouter une catégorie</button>
            </div>
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="grid grid-cols-2 font-bold p-3 bg-gray-50 border-b">
                    <div>Nom</div>
                    <div className="text-right">Actions</div>
                </div>
                <div className="divide-y divide-gray-200 max-h-[60vh] overflow-y-auto">
                    {appData.categories.map(category => (
                        <div key={category.id} className="grid grid-cols-2 p-3 items-center">
                            <div>{category.name}</div>
                            <div className="flex gap-2 justify-end">
                                <button onClick={() => openEditCategoryModal(category)} className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600">Modifier</button>
                                <button onClick={() => requestDeleteCategory(category)} className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600">Supprimer</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    const renderSales = () => (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-lg shadow">
                <div className="flex items-center gap-4">
                    <label className="font-semibold">Date:</label>
                    <input 
                        type="date" 
                        value={salesDate} 
                        onChange={(e) => setSalesDate(e.target.value)} 
                        className="px-3 py-2 border rounded-md"
                    />
                </div>
                <div className="flex gap-2">
                    <button onClick={handlePrintSales} className="px-4 py-2 bg-indigo-500 text-white rounded-md hover:bg-indigo-600">Imprimer Rapport Jour</button>
                    <button 
                        onClick={handleCloseRegister} 
                        className={`px-4 py-2 text-white rounded-md transition ${unclosedSalesForDay.length > 0 ? 'bg-orange-500 hover:bg-orange-600' : 'bg-gray-400 cursor-not-allowed'}`}
                        disabled={unclosedSalesForDay.length === 0}
                    >
                        Clôturer Caisse
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500">
                    <p className="text-gray-500 text-sm">Total Général</p>
                    <p className="text-2xl font-bold">{dailyReportData.grandTotal.toFixed(2)} TND</p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow border-l-4 border-green-500">
                    <p className="text-gray-500 text-sm">Espèces</p>
                    <p className="text-2xl font-bold">{dailyReportData.cashTotal.toFixed(2)} TND</p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-400">
                    <p className="text-gray-500 text-sm">Carte Bancaire</p>
                    <p className="text-2xl font-bold">{dailyReportData.cardTotal.toFixed(2)} TND</p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow border-l-4 border-amber-500">
                    <p className="text-gray-500 text-sm">Crédit</p>
                    <p className="text-2xl font-bold">{dailyReportData.creditTotal.toFixed(2)} TND</p>
                </div>
            </div>

            {/* Sales by Server Section - Daily */}
             <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="p-3 bg-gray-50 border-b font-bold">Ventes par Serveur</div>
                <div className="p-4">
                     {Object.keys(dailyReportData.salesByServer).length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {Object.entries(dailyReportData.salesByServer).map(([server, total]) => (
                                <div key={server} className="flex justify-between border-b py-2">
                                    <span>{server}</span>
                                    <span className="font-bold">{(total as number).toFixed(2)} TND</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-500 italic">Aucune vente par serveur.</p>
                    )}
                </div>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="grid grid-cols-4 font-bold p-3 bg-gray-50 border-b">
                    <div>Heure</div>
                    <div>Table</div>
                    <div>Serveur</div>
                    <div>Total</div>
                    <div className="text-right">Actions</div>
                </div>
                <div className="divide-y divide-gray-200 max-h-[50vh] overflow-y-auto">
                    {filteredSales.map(sale => (
                        <div key={sale.id} className={`grid grid-cols-4 p-3 items-center ${sale.status === 'voided' ? 'bg-red-50 opacity-75' : ''}`}>
                            <div className={sale.status === 'voided' ? 'line-through text-red-500' : ''}>
                                {new Date(sale.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                <span className="text-xs text-gray-500 block">#{String(sale.dailySequence).padStart(4, '0')}</span>
                            </div>
                            <div className={sale.status === 'voided' ? 'line-through text-red-500' : ''}>{sale.tableName}</div>
                            <div className={sale.status === 'voided' ? 'line-through text-red-500' : ''}>{sale.serverName || 'Staff'}</div>
                            <div className={`font-bold ${sale.status === 'voided' ? 'line-through text-red-500' : ''}`}>{sale.total.toFixed(2)} TND</div>
                            <div className="text-right">
                                {sale.status !== 'voided' && !sale.closingReportId && (
                                    <button 
                                        onClick={() => requestVoidSale(sale)}
                                        className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded hover:bg-red-200"
                                    >
                                        Annuler
                                    </button>
                                )}
                                {sale.status === 'voided' && <span className="text-xs text-red-600 font-bold">ANNULÉ</span>}
                                {sale.closingReportId && <span className="text-xs text-green-600 font-bold ml-2">CLÔTURÉ</span>}
                            </div>
                        </div>
                    ))}
                    {filteredSales.length === 0 && <div className="p-4 text-center text-gray-500">Aucune vente pour cette date.</div>}
                </div>
            </div>
            
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="p-3 bg-gray-50 border-b font-bold">Détails des Articles Vendus</div>
                 <div className="divide-y divide-gray-200 max-h-[40vh] overflow-y-auto">
                    {Object.keys(dailyReportData.items).map(name => (
                         <div key={name} className="flex justify-between p-3">
                            <span>{name}</span>
                            <span>x{dailyReportData.items[name].quantity}</span>
                            <span className="font-bold">{dailyReportData.items[name].total.toFixed(2)} TND</span>
                        </div>
                    ))}
                 </div>
            </div>
        </div>
    );

    const renderZReport = () => (
         <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow">
                 <div className="flex items-center gap-4">
                    <label className="font-semibold">Mois:</label>
                    <input 
                        type="month" 
                        value={zReportMonth} 
                        onChange={(e) => setZReportMonth(e.target.value)} 
                        className="px-3 py-2 border rounded-md"
                    />
                </div>
                 <div className="flex gap-2">
                     {/* Reset Monthly Sales Button - Only for Super Admin */}
                     {currentUser?.type === 'super-admin' && (
                        <button 
                            onClick={handleOpenResetModal}
                            title="RAZ Ventes du Mois"
                            className="p-2 bg-red-100 text-red-600 rounded-md hover:bg-red-200 border border-red-300"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                        </button>
                     )}
                    <button onClick={handleExportZReportTxt} className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600">Exporter TXT</button>
                    <button onClick={handlePrintZReport} className="px-4 py-2 bg-indigo-500 text-white rounded-md hover:bg-indigo-600">Imprimer</button>
                </div>
            </div>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-lg shadow border-l-4 border-purple-500">
                    <p className="text-gray-500 text-sm">Chiffre d'affaires</p>
                    <p className="text-2xl font-bold">{zReportData.totalSales.toFixed(2)} TND</p>
                </div>
                 <div className="bg-white p-4 rounded-lg shadow border-l-4 border-green-500">
                    <p className="text-gray-500 text-sm">Espèces</p>
                    <p className="text-2xl font-bold">{zReportData.cashTotal.toFixed(2)} TND</p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-400">
                    <p className="text-gray-500 text-sm">Carte Bancaire</p>
                    <p className="text-2xl font-bold">{zReportData.cardTotal.toFixed(2)} TND</p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow border-l-4 border-amber-500">
                    <p className="text-gray-500 text-sm">Crédit</p>
                    <p className="text-2xl font-bold">{zReportData.creditTotal.toFixed(2)} TND</p>
                </div>
            </div>
            
            {/* Sales by Server Section - Z Report */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="p-3 bg-gray-50 border-b font-bold">Ventes par Serveur (Mensuel)</div>
                <div className="p-4">
                     {Object.keys(zReportData.salesByServer).length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {Object.entries(zReportData.salesByServer).map(([server, total]) => (
                                <div key={server} className="flex justify-between border-b py-2">
                                    <span>{server}</span>
                                    <span className="font-bold">{(total as number).toFixed(2)} TND</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-500 italic">Aucune vente par serveur.</p>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="p-3 bg-gray-50 border-b font-bold">Ventes par Catégorie</div>
                    <div className="p-4 space-y-2">
                        {Object.keys(zReportData.salesByCategory).map(cat => (
                            <div key={cat} className="flex justify-between">
                                <span>{cat}</span>
                                <span className="font-bold">{zReportData.salesByCategory[cat].toFixed(2)} TND</span>
                            </div>
                        ))}
                    </div>
                </div>
                
                 <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="p-3 bg-gray-50 border-b font-bold">Top Articles</div>
                     <div className="divide-y divide-gray-200 max-h-[40vh] overflow-y-auto">
                        {Object.keys(zReportData.monthlyItemsSummary)
                            .sort((a, b) => zReportData.monthlyItemsSummary[b].quantity - zReportData.monthlyItemsSummary[a].quantity)
                            .slice(0, 10)
                            .map(name => (
                             <div key={name} className="flex justify-between p-3">
                                <span>{name}</span>
                                <span className="text-gray-500">x{zReportData.monthlyItemsSummary[name].quantity}</span>
                                <span className="font-bold">{zReportData.monthlyItemsSummary[name].total.toFixed(2)} TND</span>
                            </div>
                        ))}
                     </div>
                </div>
            </div>
         </div>
    );
    
    const renderSettings = () => (
         <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Password Management */}
                <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-lg font-bold mb-4">Changer le mot de passe Admin</h3>
                    <form onSubmit={handleSubmitNewPassword} className="space-y-3">
                        <input 
                            type="password" name="current" placeholder="Mot de passe actuel" 
                            className="w-full border p-2 rounded" 
                            value={passwordChangeForm.current} onChange={handlePasswordFormChange}
                        />
                         <input 
                            type="password" name="newPass" placeholder="Nouveau mot de passe" 
                            className="w-full border p-2 rounded" 
                            value={passwordChangeForm.newPass} onChange={handlePasswordFormChange}
                        />
                         <input 
                            type="password" name="confirmPass" placeholder="Confirmer nouveau mot de passe" 
                            className="w-full border p-2 rounded" 
                            value={passwordChangeForm.confirmPass} onChange={handlePasswordFormChange}
                        />
                        <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">Mettre à jour</button>
                        {passwordMessage.text && (
                            <p className={`text-sm ${passwordMessage.type === 'error' ? 'text-red-500' : 'text-green-500'}`}>{passwordMessage.text}</p>
                        )}
                    </form>
                </div>
                
                 {/* Establishment Name Management */}
                 <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-lg font-bold mb-4">Nom de l'établissement</h3>
                    <p className="text-sm text-gray-500 mb-2">Ce nom sera affiché sur les tickets.</p>
                    <form onSubmit={handleSubmitEstablishmentName} className="space-y-3">
                        <input 
                            type="text" name="establishmentName" placeholder="Ex: Le Bar de la Plage" 
                            className="w-full border p-2 rounded" 
                            value={establishmentName} onChange={handleEstablishmentNameChange}
                        />
                        <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">Enregistrer</button>
                         {establishmentNameMessage.text && (
                            <p className={`text-sm ${establishmentNameMessage.type === 'error' ? 'text-red-500' : 'text-green-500'}`}>{establishmentNameMessage.text}</p>
                        )}
                    </form>
                </div>

                {/* Background Image */}
                 <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-lg font-bold mb-4">Image de fond</h3>
                     <div className="flex gap-2 items-center">
                        <input type="file" accept="image/*" onChange={handleBackgroundImageChange} className="text-sm" />
                        {appData.backgroundImage && (
                             <button onClick={removeBackgroundImage} className="text-red-500 hover:text-red-700 text-sm">Supprimer</button>
                        )}
                     </div>
                     {appData.backgroundImage && (
                        <div className="mt-2 h-20 w-full bg-cover bg-center rounded border" style={{ backgroundImage: `url(${appData.backgroundImage})` }}></div>
                     )}
                </div>
                
                {/* Reset Data */}
                 <div className="bg-white p-6 rounded-lg shadow border-l-4 border-red-500">
                    <h3 className="text-lg font-bold mb-2 text-red-600">Zone de Danger</h3>
                    <p className="text-sm text-gray-600 mb-4">Supprimer toutes les ventes, produits et configurations pour repartir à zéro.</p>
                    <button 
                        onClick={() => {
                            if(window.confirm("ATTENTION: Cette action est irréversible. Êtes-vous sûr de vouloir tout effacer ?")) {
                                localStorage.removeItem('barPOSData');
                                window.location.reload();
                            }
                        }} 
                        className="w-full bg-red-100 text-red-600 border border-red-300 py-2 rounded hover:bg-red-200"
                    >
                        Réinitialiser l'application
                    </button>
                </div>
            </div>
            
            {/* Printers Management */}
             <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex justify-between items-center mb-4">
                     <h3 className="text-lg font-bold">Imprimantes</h3>
                     <button onClick={openAddPrinterModal} className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600">Ajouter Imprimante</button>
                </div>
                <div className="space-y-2">
                     {appData.printers.length === 0 ? <p className="text-gray-500 italic">Aucune imprimante configurée.</p> : (
                        appData.printers.map(printer => (
                            <div key={printer.id} className="flex justify-between items-center border p-2 rounded hover:bg-gray-50">
                                <div>
                                    <span className="font-bold">{printer.name}</span>
                                    <span className="text-gray-400 text-sm mx-2">({printer.type})</span>
                                    {printer.id === appData.defaultPrinterId && <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">Défaut</span>}
                                    {printer.address && <div className="text-xs text-gray-500">ID: {printer.address}</div>}
                                </div>
                                <div className="flex gap-2">
                                     {printer.id !== appData.defaultPrinterId && (
                                        <button onClick={() => handleSetDefaultPrinter(printer.id)} className="text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded">Mettre par défaut</button>
                                     )}
                                    <button onClick={() => openEditPrinterModal(printer)} className="text-blue-500 hover:text-blue-700">Modif.</button>
                                    <button onClick={() => requestDeletePrinter(printer)} className="text-red-500 hover:text-red-700">Suppr.</button>
                                </div>
                            </div>
                        ))
                     )}
                </div>
                 <div className="mt-4 p-3 bg-blue-50 text-blue-800 text-sm rounded border border-blue-200">
                    <p><strong>Info Impression:</strong> Sur Android (App), l'impression est directe pour Bluetooth/Réseau. Sur PC/Web, la boîte de dialogue système s'ouvre.</p>
                </div>
            </div>

            {/* Servers Management */}
            <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex justify-between items-center mb-4">
                     <h3 className="text-lg font-bold">Serveurs</h3>
                     <button onClick={openAddServerModal} className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600">Ajouter Serveur</button>
                </div>
                <div className="space-y-2">
                     {appData.servers.length === 0 ? <p className="text-gray-500 italic">Aucun serveur supplémentaire.</p> : (
                        appData.servers.map(server => (
                            <div key={server.id} className="flex justify-between items-center border p-2 rounded hover:bg-gray-50">
                                <div>
                                    <span className="font-bold">{server.name}</span>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => openEditServerModal(server)} className="text-blue-500 hover:text-blue-700">Modif.</button>
                                    <button onClick={() => requestDeleteServer(server)} className="text-red-500 hover:text-red-700">Suppr.</button>
                                </div>
                            </div>
                        ))
                     )}
                </div>
            </div>
            
            {/* Rooms & Tables Management */}
            <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex justify-between items-center mb-4">
                     <h3 className="text-lg font-bold">Salles et Tables</h3>
                     <button onClick={openAddRoomModal} className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600">Ajouter Salle</button>
                </div>
                <div className="space-y-4">
                    {appData.rooms.map(room => (
                        <div key={room.id} className="border rounded p-3">
                            <div className="flex justify-between items-center mb-2 border-b pb-2">
                                <h4 className="font-bold text-gray-700">{room.name}</h4>
                                <div className="flex gap-2">
                                    <button onClick={() => openAddTableModal(room.id)} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200">+ Table</button>
                                    <button onClick={() => openEditRoomModal(room)} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200">Modif.</button>
                                    <button onClick={() => requestDeleteRoom(room)} className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200">Suppr.</button>
                                </div>
                            </div>
                            <div className="grid grid-cols-4 gap-2">
                                {appData.tables.filter(t => t.roomId === room.id).map(table => (
                                    <div key={table.id} className="text-sm border p-1 rounded flex justify-between items-center bg-gray-50">
                                        <span>{table.name}</span>
                                        <div className="flex gap-1">
                                            <button onClick={() => openEditTableModal(table)} className="text-blue-500 hover:text-blue-700">✎</button>
                                            <button onClick={() => requestDeleteTable(table)} className="text-red-500 hover:text-red-700">×</button>
                                        </div>
                                    </div>
                                ))}
                                {appData.tables.filter(t => t.roomId === room.id).length === 0 && <span className="text-xs text-gray-400 italic">Aucune table</span>}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
         </div>
    );

    return (
        <div className="fixed inset-0 bg-gray-100 z-50 flex flex-col overflow-hidden">
            <div className="bg-slate-800 text-white p-4 flex justify-between items-center shadow-md">
                <h2 className="text-xl font-bold">Administration {currentUser?.type === 'super-admin' ? '(Super Admin)' : ''}</h2>
                <button onClick={closePanel} className="px-4 py-2 bg-slate-600 hover:bg-slate-500 rounded text-sm">Fermer</button>
            </div>
            
            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar Navigation */}
                <div className="w-64 bg-white border-r flex flex-col">
                    <button 
                        onClick={() => setActiveTab('sales')}
                        className={`p-4 text-left border-b hover:bg-gray-50 ${activeTab === 'sales' ? 'bg-blue-50 text-blue-600 font-bold border-l-4 border-l-blue-600' : 'text-gray-700'}`}
                    >
                        Ventes (Jour)
                    </button>
                    <button 
                        onClick={() => setActiveTab('z-report')}
                        className={`p-4 text-left border-b hover:bg-gray-50 ${activeTab === 'z-report' ? 'bg-blue-50 text-blue-600 font-bold border-l-4 border-l-blue-600' : 'text-gray-700'}`}
                    >
                        Rapport Z (Mois)
                    </button>
                    <button 
                        onClick={() => setActiveTab('products')}
                        className={`p-4 text-left border-b hover:bg-gray-50 ${activeTab === 'products' ? 'bg-blue-50 text-blue-600 font-bold border-l-4 border-l-blue-600' : 'text-gray-700'}`}
                    >
                        Produits
                    </button>
                    <button 
                        onClick={() => setActiveTab('categories')}
                        className={`p-4 text-left border-b hover:bg-gray-50 ${activeTab === 'categories' ? 'bg-blue-50 text-blue-600 font-bold border-l-4 border-l-blue-600' : 'text-gray-700'}`}
                    >
                        Catégories
                    </button>
                     <button 
                        onClick={() => setActiveTab('settings')}
                        className={`p-4 text-left border-b hover:bg-gray-50 ${activeTab === 'settings' ? 'bg-blue-50 text-blue-600 font-bold border-l-4 border-l-blue-600' : 'text-gray-700'}`}
                    >
                        Paramètres
                    </button>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 overflow-y-auto p-8 bg-gray-100">
                    {activeTab === 'sales' && renderSales()}
                    {activeTab === 'z-report' && renderZReport()}
                    {activeTab === 'products' && renderProducts()}
                    {activeTab === 'categories' && renderCategories()}
                    {activeTab === 'settings' && renderSettings()}
                </div>
            </div>

            {/* Modals */}
            <Modal title={editingProduct ? "Modifier Produit" : "Ajouter Produit"} isOpen={isProductModalOpen} onClose={() => setProductModalOpen(false)}>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Nom</label>
                        <input type="text" name="name" value={productForm.name} onChange={handleProductFormChange} className="w-full border p-2 rounded" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Prix</label>
                        <input type="number" step="0.1" name="price" value={productForm.price} onChange={handleProductFormChange} className="w-full border p-2 rounded" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Catégorie</label>
                        <select name="categoryId" value={productForm.categoryId} onChange={handleProductFormChange} className="w-full border p-2 rounded">
                            {appData.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div>
                         <label className="block text-sm font-medium mb-1">Imprimante (Préparation)</label>
                         <select name="printerId" value={productForm.printerId} onChange={handleProductFormChange} className="w-full border p-2 rounded">
                            <option value="">Par défaut (Système ou Principale)</option>
                            {appData.printers.map(p => <option key={p.id} value={p.id}>{p.name} ({p.type})</option>)}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">L'imprimante où sera envoyé ce produit lors de l'impression "Préparation".</p>
                    </div>
                    <button onClick={handleSaveProduct} className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">Sauvegarder</button>
                </div>
            </Modal>
            
            <Modal title="Confirmer Suppression Produit" isOpen={!!productToDelete} onClose={() => setProductToDelete(null)}>
                <p>Voulez-vous vraiment supprimer "{productToDelete?.name}" ?</p>
                <div className="flex justify-end gap-2 mt-4">
                    <button onClick={() => setProductToDelete(null)} className="px-4 py-2 bg-gray-200 rounded">Annuler</button>
                    <button onClick={handleConfirmDelete} className="px-4 py-2 bg-red-600 text-white rounded">Supprimer</button>
                </div>
            </Modal>

            <Modal title={editingCategory ? "Modifier Catégorie" : "Ajouter Catégorie"} isOpen={isCategoryModalOpen} onClose={() => setCategoryModalOpen(false)}>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Nom</label>
                        <input type="text" value={categoryForm.name} onChange={(e) => setCategoryForm({ name: e.target.value })} className="w-full border p-2 rounded" />
                    </div>
                    <button onClick={handleSaveCategory} className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">Sauvegarder</button>
                </div>
            </Modal>

            <Modal title="Confirmer Suppression Catégorie" isOpen={!!categoryToDelete} onClose={() => setCategoryToDelete(null)}>
                <p>Voulez-vous vraiment supprimer la catégorie "{categoryToDelete?.name}" ?</p>
                <div className="flex justify-end gap-2 mt-4">
                    <button onClick={() => setCategoryToDelete(null)} className="px-4 py-2 bg-gray-200 rounded">Annuler</button>
                    <button onClick={handleConfirmDeleteCategory} className="px-4 py-2 bg-red-600 text-white rounded">Supprimer</button>
                </div>
            </Modal>
            
            <Modal title={editingServer ? "Modifier Serveur" : "Ajouter Serveur"} isOpen={isServerModalOpen} onClose={() => setServerModalOpen(false)}>
                 <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Nom d'utilisateur</label>
                        <input type="text" value={serverForm.name} onChange={(e) => setServerForm({ ...serverForm, name: e.target.value })} className="w-full border p-2 rounded" />
                    </div>
                     <div>
                        <label className="block text-sm font-medium mb-1">Mot de passe</label>
                        <input type="text" value={serverForm.password} onChange={(e) => setServerForm({ ...serverForm, password: e.target.value })} className="w-full border p-2 rounded" placeholder={editingServer ? "Laisser vide pour ne pas changer" : "Requis"} />
                    </div>
                    <button onClick={handleSaveServer} className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">Sauvegarder</button>
                </div>
            </Modal>

             <Modal title="Confirmer Suppression Serveur" isOpen={!!serverToDelete} onClose={() => setServerToDelete(null)}>
                <p>Voulez-vous vraiment supprimer le serveur "{serverToDelete?.name}" ?</p>
                <div className="flex justify-end gap-2 mt-4">
                    <button onClick={() => setServerToDelete(null)} className="px-4 py-2 bg-gray-200 rounded">Annuler</button>
                    <button onClick={handleConfirmDeleteServer} className="px-4 py-2 bg-red-600 text-white rounded">Supprimer</button>
                </div>
            </Modal>

             <Modal title={editingRoom ? "Modifier Salle" : "Ajouter Salle"} isOpen={isRoomModalOpen} onClose={() => setRoomModalOpen(false)}>
                 <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Nom de la salle</label>
                        <input type="text" value={roomForm.name} onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })} className="w-full border p-2 rounded" />
                    </div>
                    <button onClick={handleSaveRoom} className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">Sauvegarder</button>
                </div>
            </Modal>
            
             <Modal title="Confirmer Suppression Salle" isOpen={!!roomToDelete} onClose={() => setRoomToDelete(null)}>
                <p>Voulez-vous vraiment supprimer la salle "{roomToDelete?.name}" ?</p>
                <div className="flex justify-end gap-2 mt-4">
                    <button onClick={() => setRoomToDelete(null)} className="px-4 py-2 bg-gray-200 rounded">Annuler</button>
                    <button onClick={handleConfirmDeleteRoom} className="px-4 py-2 bg-red-600 text-white rounded">Supprimer</button>
                </div>
            </Modal>
            
             <Modal title={editingTable ? "Modifier Table" : "Ajouter Table"} isOpen={isTableModalOpen} onClose={() => setTableModalOpen(false)}>
                 <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Nom de la table</label>
                        <input type="text" value={tableForm.name} onChange={(e) => setTableForm({ ...tableForm, name: e.target.value })} className="w-full border p-2 rounded" placeholder="ex: Table 1" />
                    </div>
                    <button onClick={handleSaveTable} className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">Sauvegarder</button>
                </div>
            </Modal>
            
            <Modal title="Confirmer Suppression Table" isOpen={!!tableToDelete} onClose={() => setTableToDelete(null)}>
                <p>Voulez-vous vraiment supprimer la table "{tableToDelete?.name}" ?</p>
                <div className="flex justify-end gap-2 mt-4">
                    <button onClick={() => setTableToDelete(null)} className="px-4 py-2 bg-gray-200 rounded">Annuler</button>
                    <button onClick={handleConfirmDeleteTable} className="px-4 py-2 bg-red-600 text-white rounded">Supprimer</button>
                </div>
            </Modal>

            <Modal title={editingPrinter ? "Modifier Imprimante" : "Ajouter Imprimante"} isOpen={isPrinterModalOpen} onClose={() => setPrinterModalOpen(false)}>
                <div className="space-y-4 max-h-[80vh] overflow-y-auto">
                     <div>
                        <label className="block text-sm font-medium mb-1">Nom (ex: Cuisine, Bar)</label>
                        <input type="text" value={printerForm.name} onChange={(e) => setPrinterForm({...printerForm, name: e.target.value})} className="w-full border p-2 rounded" />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium mb-1">Type de connexion</label>
                        <select value={printerForm.type} onChange={(e) => setPrinterForm({...printerForm, type: e.target.value as PrinterType})} className="w-full border p-2 rounded">
                            <option value="system">Imprimante Système (PC/USB/Navigateur)</option>
                            <option value="network">Réseau (WiFi / Ethernet)</option>
                            <option value="bluetooth">Bluetooth</option>
                        </select>
                    </div>

                    {(printerForm.type === 'network' || printerForm.type === 'bluetooth') && (
                        <div className="p-3 bg-gray-50 border rounded space-y-3">
                             {/* Network Specifics */}
                             {printerForm.type === 'network' && (
                                <>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="col-span-2">
                                            <label className="block text-xs font-medium text-gray-500">Sous-réseau (ex: 192.168.1)</label>
                                            <input type="text" value={scanSubnet} onChange={(e) => setScanSubnet(e.target.value)} className="w-full border p-1 rounded text-sm" />
                                        </div>
                                        <div>
                                             <label className="block text-xs font-medium text-gray-500">Port (9100)</label>
                                             <input type="text" value={scanPortStart} onChange={(e) => setScanPortStart(e.target.value)} className="w-full border p-1 rounded text-sm" />
                                        </div>
                                    </div>
                                    <button 
                                        onClick={isScanningNetwork ? stopNetworkScan : startNetworkScan}
                                        className={`w-full py-2 text-sm text-white rounded font-bold ${isScanningNetwork ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'}`}
                                    >
                                        {isScanningNetwork ? 'Arrêter Scan' : 'Lancer Scan Réseau'}
                                    </button>
                                    
                                    {networkScanMessage && <p className="text-xs text-blue-600 mt-1">{networkScanMessage}</p>}
                                    
                                    {foundIpAddresses.length > 0 && (
                                        <div className="mt-2 border rounded p-2 bg-white max-h-32 overflow-y-auto">
                                            <p className="text-xs font-bold mb-1">Appareils trouvés (Port 80/9100) :</p>
                                            {foundIpAddresses.map(ip => (
                                                <button 
                                                    key={ip} 
                                                    onClick={() => setPrinterForm({...printerForm, address: ip})}
                                                    className="block w-full text-left text-sm p-1 hover:bg-blue-50 text-blue-600"
                                                >
                                                    {ip}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Adresse IP</label>
                                        <input type="text" value={printerForm.address} onChange={(e) => setPrinterForm({...printerForm, address: e.target.value})} className="w-full border p-2 rounded" placeholder="192.168.1.200" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Port</label>
                                        <input type="number" value={printerForm.port} onChange={(e) => setPrinterForm({...printerForm, port: e.target.value})} className="w-full border p-2 rounded" placeholder="9100" />
                                    </div>
                                </>
                            )}
                            
                            {/* Bluetooth Specifics */}
                            {printerForm.type === 'bluetooth' && (
                                <>
                                    <button 
                                        onClick={handleSearchPrinter} 
                                        disabled={isSearchingPrinter}
                                        className="w-full bg-blue-500 text-white py-2 rounded text-sm flex justify-center items-center gap-2"
                                    >
                                        {isSearchingPrinter ? <span className="animate-spin">⌛</span> : '🔍'}
                                        {isSearchingPrinter ? 'Recherche...' : 'Chercher Périphérique Bluetooth'}
                                    </button>
                                    {searchMessage && <p className="text-xs text-blue-600 whitespace-pre-wrap">{searchMessage}</p>}
                                    <div>
                                        <label className="block text-sm font-medium mb-1">ID Périphérique (Adresse/UUID)</label>
                                        <input 
                                            type="text" 
                                            value={printerForm.address} 
                                            readOnly 
                                            className="w-full border p-2 rounded bg-gray-100 text-gray-500" 
                                            placeholder="Sera rempli par la recherche" 
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                    
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                        <h4 className="font-bold text-sm mb-2 text-yellow-800">Configuration ESC/POS (Avancé)</h4>
                        <div className="flex items-center gap-2 mb-2">
                             <input 
                                type="checkbox" 
                                id="useEscPos"
                                checked={printerForm.useEscPos} 
                                onChange={(e) => setPrinterForm({...printerForm, useEscPos: e.target.checked})} 
                            />
                            <label htmlFor="useEscPos" className="text-sm">Activer le mode ESC/POS (RAW)</label>
                        </div>
                        {printerForm.useEscPos && (
                            <div className="grid grid-cols-2 gap-2">
                                 <div>
                                    <label className="block text-xs font-medium">Largeur Papier</label>
                                    <select 
                                        value={printerForm.paperWidth} 
                                        onChange={(e) => setPrinterForm({...printerForm, paperWidth: e.target.value})}
                                        className="w-full border p-1 rounded text-sm"
                                    >
                                        <option value="80">80mm (Standard)</option>
                                        <option value="58">58mm (Petit)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium">Encodage</label>
                                    <select 
                                        value={printerForm.encoding} 
                                        onChange={(e) => setPrinterForm({...printerForm, encoding: e.target.value})}
                                        className="w-full border p-1 rounded text-sm"
                                    >
                                        <option value="PC858">PC858 (Euro)</option>
                                        <option value="PC437">PC437 (USA/Standard)</option>
                                        <option value="UTF-8">UTF-8</option>
                                    </select>
                                </div>
                            </div>
                        )}
                        <p className="text-xs text-gray-500 mt-1">Recommandé pour les imprimantes thermiques Bluetooth/Réseau pour une impression plus rapide.</p>
                    </div>

                    <button onClick={handleSavePrinter} className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">Sauvegarder</button>
                </div>
            </Modal>
            
            <Modal title="Confirmer Suppression Imprimante" isOpen={!!printerToDelete} onClose={() => setPrinterToDelete(null)}>
                <p>Voulez-vous vraiment supprimer l'imprimante "{printerToDelete?.name}" ?</p>
                <div className="flex justify-end gap-2 mt-4">
                    <button onClick={() => setPrinterToDelete(null)} className="px-4 py-2 bg-gray-200 rounded">Annuler</button>
                    <button onClick={handleConfirmDeletePrinter} className="px-4 py-2 bg-red-600 text-white rounded">Supprimer</button>
                </div>
            </Modal>
            
             <Modal title="Sélectionner le mois à réinitialiser" isOpen={isResetDateSelectModalOpen} onClose={() => setIsResetDateSelectModalOpen(false)}>
                <div className="space-y-4">
                     <p className="text-sm text-gray-600">Choisissez le mois et l'année pour lesquels vous souhaitez supprimer définitivement toutes les ventes.</p>
                     <div className="flex gap-2">
                         <div className="flex-1">
                             <label className="block text-sm font-medium mb-1">Mois</label>
                             <select 
                                value={resetMonthYear.month} 
                                onChange={(e) => setResetMonthYear({...resetMonthYear, month: parseInt(e.target.value)})}
                                className="w-full border p-2 rounded"
                             >
                                {Array.from({length: 12}, (_, i) => i + 1).map(m => (
                                    <option key={m} value={m}>{new Date(2000, m-1, 1).toLocaleString('fr-FR', {month: 'long'})}</option>
                                ))}
                             </select>
                         </div>
                         <div className="flex-1">
                             <label className="block text-sm font-medium mb-1">Année</label>
                              <select 
                                value={resetMonthYear.year} 
                                onChange={(e) => setResetMonthYear({...resetMonthYear, year: parseInt(e.target.value)})}
                                className="w-full border p-2 rounded"
                             >
                                {Array.from({length: 5}, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                             </select>
                         </div>
                     </div>
                     <button onClick={handleConfirmDateSelection} className="w-full bg-red-600 text-white py-2 rounded hover:bg-red-700 font-bold">Continuer</button>
                </div>
            </Modal>

            <Modal title="CONFIRMATION ULTIME" isOpen={isResetConfirmModalOpen} onClose={() => setIsResetConfirmModalOpen(false)}>
                <div className="space-y-4 text-center">
                    <div className="text-red-600 text-4xl">⚠️</div>
                    <h3 className="font-bold text-lg text-red-600">Action Irréversible</h3>
                    <p>Vous êtes sur le point de supprimer TOUTES les ventes du mois de :</p>
                    <p className="font-bold text-xl">{new Date(monthToReset + '-02').toLocaleString('fr-FR', { month: 'long', year: 'numeric' })}</p>
                    <p className="text-sm text-gray-500">Ces données seront perdues à jamais. Êtes-vous absolument sûr ?</p>
                    <div className="flex gap-3 justify-center mt-6">
                        <button onClick={() => setIsResetConfirmModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">Annuler</button>
                        <button onClick={handleResetMonthlySales} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 font-bold">OUI, TOUT SUPPRIMER</button>
                    </div>
                </div>
            </Modal>
            
            <Modal title="Autorisation Requise" isOpen={isVoidPasswordModalOpen} onClose={() => setVoidPasswordModalOpen(false)}>
                 <div className="space-y-4">
                    <p className="text-gray-600 text-sm">Veuillez entrer le mot de passe administrateur pour annuler ce ticket.</p>
                    <input
                        type="password"
                        value={voidPasswordInput}
                        onChange={(e) => { setVoidPasswordInput(e.target.value); setVoidPasswordError(''); }}
                        className="w-full px-3 py-2 border rounded-md"
                        placeholder="Mot de passe Admin"
                        autoFocus
                    />
                    {voidPasswordError && <p className="text-red-500 text-sm">{voidPasswordError}</p>}
                    <div className="flex justify-end gap-3 mt-4">
                        <button onClick={() => setVoidPasswordModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">Annuler</button>
                        <button onClick={handleConfirmSaleVoid} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">Confirmer Annulation</button>
                    </div>
                </div>
            </Modal>

        </div>
    );
};
