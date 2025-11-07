import React, { useState, useMemo, useEffect } from 'react';
import { AppData, Product, Category, ClosingReport } from '../types';
import Modal from './Modal';

interface AdminPanelProps {
    appData: AppData;
    setAppData: React.Dispatch<React.SetStateAction<AppData>>;
    closePanel: () => void;
    currentPassword?: string;
    onPasswordChange?: (newPassword: string) => Promise<void>;
    onRecipientEmailChange?: (newEmail: string) => Promise<void>;
}

// FIX: Define interfaces for complex objects returned by useMemo to ensure correct type inference.
interface DailyReportData {
    items: { [key: string]: { quantity: number; total: number } };
    grandTotal: number;
    cashTotal: number;
    cardTotal: number;
    creditTotal: number;
}

interface ZReportData {
    totalSales: number;
    salesByCategory: { [key: string]: number };
    count: number;
    monthlyItemsSummary: { [key: string]: { quantity: number; total: number } };
    cashTotal: number;
    cardTotal: number;
    creditTotal: number;
}

type AdminTab = 'products' | 'categories' | 'sales' | 'z-report' | 'settings';

const AdminPanel: React.FC<AdminPanelProps> = ({ appData, setAppData, closePanel, currentPassword, onPasswordChange, onRecipientEmailChange }) => {
    const [activeTab, setActiveTab] = useState<AdminTab>('sales');
    
    // Product State
    const [isProductModalOpen, setProductModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [productForm, setProductForm] = useState({ name: '', price: '', categoryId: '' });
    const [productToDelete, setProductToDelete] = useState<Product | null>(null);
    
    // Category State
    const [isCategoryModalOpen, setCategoryModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [categoryForm, setCategoryForm] = useState({ name: '' });
    const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);

    const [salesDate, setSalesDate] = useState(new Date().toISOString().split('T')[0]);
    const [zReportMonth, setZReportMonth] = useState(new Date().toISOString().substring(0, 7));

    // State for password change form
    const [passwordChangeForm, setPasswordChangeForm] = useState({ current: '', newPass: '', confirmPass: '' });
    const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' });
    
    // State for email change form
    const [recipientEmail, setRecipientEmail] = useState(appData.recipientEmail);
    const [emailMessage, setEmailMessage] = useState({ type: '', text: '' });

    useEffect(() => {
        if (!editingProduct) return;

        const handler = setTimeout(() => {
            const name = productForm.name.trim();
            const price = parseFloat(productForm.price);
            const categoryId = parseInt(productForm.categoryId, 10);

            // Prevent saving if values haven't changed
            if (
                editingProduct.name === name &&
                editingProduct.price === price &&
                editingProduct.categoryId === categoryId
            ) {
                return;
            }

            // Basic validation before auto-saving
            if (!name || isNaN(price) || price <= 0 || isNaN(categoryId)) {
                return;
            }

            const updatedProduct: Product = {
                id: editingProduct.id,
                name,
                price,
                categoryId
            };

            setAppData(prev => ({
                ...prev,
                products: prev.products.map(p => p.id === editingProduct.id ? updatedProduct : p)
            }));
            
        }, 500); // Debounce time for auto-save

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
        setProductForm({ name: '', price: '', categoryId: appData.categories[0]?.id.toString() || '' });
        setProductModalOpen(true);
    };

    const openEditProductModal = (product: Product) => {
        setEditingProduct(product);
        setProductForm({
            name: product.name,
            price: product.price.toString(),
            categoryId: product.categoryId.toString()
        });
        setProductModalOpen(true);
    };

    const handleSaveProduct = () => {
        const { name, price, categoryId } = productForm;
        if (!name.trim() || !price || !categoryId) {
            alert("Veuillez remplir tous les champs.");
            return;
        }

        const newProduct = {
            id: editingProduct ? editingProduct.id : Date.now(),
            name: name.trim(),
            price: parseFloat(price),
            categoryId: parseInt(categoryId)
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

    const filteredSales = useMemo(() => {
        return appData.sales.filter(sale => sale.date.startsWith(salesDate) && sale.isFinal);
    }, [appData.sales, salesDate]);

    const unclosedSalesForDay = useMemo(() => {
        return filteredSales.filter(sale => !sale.closingReportId);
    }, [filteredSales]);

    const closingsForDay = useMemo(() => {
        return appData.closingReports
            .filter(report => report.date === salesDate)
            .sort((a, b) => a.sequence - b.sequence);
    }, [appData.closingReports, salesDate]);

    // FIX: Add explicit return type to useMemo to prevent TypeScript from inferring `unknown` for its properties.
    const dailyReportData = useMemo((): DailyReportData => {
        const summary: { [key: string]: { quantity: number; total: number } } = {};
        let grandTotal = 0;
        let cashTotal = 0;
        let cardTotal = 0;
        let creditTotal = 0;
        
        filteredSales.forEach(sale => {
            grandTotal += sale.total;
            if (sale.paymentMethod === 'cash') {
                cashTotal += sale.total;
            } else if (sale.paymentMethod === 'card') {
                cardTotal += sale.total;
            } else if (sale.paymentMethod === 'credit') {
                creditTotal += sale.total;
            }

            sale.items.forEach(item => {
                if (!summary[item.name]) {
                    summary[item.name] = { quantity: 0, total: 0 };
                }
                summary[item.name].quantity += item.quantity;
                const itemTotal = item.price * item.quantity;
                summary[item.name].total += itemTotal;
            });
        });
        
        return { items: summary, grandTotal, cashTotal, cardTotal, creditTotal };
    }, [filteredSales]);

    // FIX: Add explicit return type to useMemo to prevent TypeScript from inferring `unknown` for its properties.
    const zReportData = useMemo((): ZReportData => {
        const salesInMonth = appData.sales.filter(sale => sale.date.startsWith(zReportMonth) && sale.isFinal);
        const totalSales = salesInMonth.reduce((sum, sale) => sum + sale.total, 0);
        const cashTotal = salesInMonth.filter(s => s.paymentMethod === 'cash').reduce((sum, s) => sum + s.total, 0);
        const cardTotal = salesInMonth.filter(s => s.paymentMethod === 'card').reduce((sum, s) => sum + s.total, 0);
        const creditTotal = salesInMonth.filter(s => s.paymentMethod === 'credit').reduce((sum, s) => sum + s.total, 0);

        const salesByCategory: { [key: string]: number } = {};
        const monthlyItemsSummary: { [key: string]: { quantity: number; total: number } } = {};

        salesInMonth.forEach(sale => {
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
        
        return { totalSales, salesByCategory, count: salesInMonth.length, monthlyItemsSummary, cashTotal, cardTotal, creditTotal };
    }, [appData.sales, appData.products, appData.categories, zReportMonth]);

    const printHTMLContent = (htmlContent: string) => {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(htmlContent);
            printWindow.document.close();
            printWindow.focus();
            printWindow.print();
            printWindow.close();
        }
    };
    
    const printClosingReport = (report: ClosingReport) => {
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
                    <table>
                        <thead>
                            <tr>
                                <th>Article</th>
                                <th class="text-center">Quantité</th>
                                <th class="text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${/* FIX: Use Object.keys to avoid type inference issues with Object.entries */ ''}
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
                </body>
            </html>
        `;
        printHTMLContent(printContent);
    };

    const sendClosingReportByEmail = (report: ClosingReport) => {
        const recipient = appData.recipientEmail;
        const subject = `Rapport de Clôture - ${report.date}`;
        
        const body = `
            <h3>Rapport de Clôture du ${new Date(report.date + 'T00:00:00').toLocaleDateString('fr-FR')} (N°${report.sequence})</h3>
            <p>Bonjour,</p>
            <p>Voici le résumé de la clôture de caisse pour la journée.</p>
            <hr>
            <h4>Résumé des Ventes</h4>
            <ul>
                <li><strong>Total Général:</strong> ${report.total.toFixed(2)} TND</li>
                <li><strong>Total Espèces:</strong> ${report.cashTotal.toFixed(2)} TND</li>
                <li><strong>Total Carte:</strong> ${report.cardTotal.toFixed(2)} TND</li>
                <li><strong>Total Crédit:</strong> ${report.creditTotal.toFixed(2)} TND</li>
            </ul>
            <hr>
            <h4>Détail des Articles Vendus</h4>
            <table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; width: 100%;">
                <thead>
                    <tr style="background-color: #f2f2f2;">
                        <th style="text-align: left;">Article</th>
                        <th style="text-align: center;">Quantité</th>
                        <th style="text-align: right;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${/* FIX: Use Object.keys to avoid type inference issues with Object.entries */ ''}
                    ${Object.keys(report.itemsSummary).map((name) => {
                        const data = report.itemsSummary[name];
                        return `
                        <tr>
                            <td>${name}</td>
                            <td style="text-align: center;">${data.quantity}</td>
                            <td style="text-align: right;">${data.total.toFixed(2)} TND</td>
                        </tr>
                    `;
                    }).join('')}
                </tbody>
            </table>
            <br>
            <p>Cordialement,<br>Le Système de Caisse AHIC</p>
        `;

        const mailtoLink = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.open(mailtoLink, '_blank');
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

        const newClosingReport: ClosingReport = {
            id: Date.now(),
            date: salesDate,
            sequence: closingsForDay.length + 1,
            salesIds: salesIdsToClose,
            total: grandTotal,
            cashTotal,
            cardTotal,
            creditTotal,
            itemsSummary: summary
        };

        printClosingReport(newClosingReport);
        sendClosingReportByEmail(newClosingReport);

        setAppData(prev => {
            const updatedSales = prev.sales.map(sale => {
                if (salesIdsToClose.includes(sale.id)) {
                    return { ...sale, closingReportId: newClosingReport.id };
                }
                return sale;
            });

            return {
                ...prev,
                sales: updatedSales,
                closingReports: [...prev.closingReports, newClosingReport]
            };
        });
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
                    <table>
                        <thead>
                            <tr>
                                <th>Article</th>
                                <th class="text-center">Quantité</th>
                                <th class="text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${/* FIX: Use Object.keys to avoid type inference issues with Object.entries */ ''}
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
        printHTMLContent(printContent);
    };
    
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
        content += 'VENTES PAR MODE DE PAIEMENT\n';
        content += '-------------------------------------------------------\n';
        content += `Espèces: ${zReportData.cashTotal.toFixed(2)} TND\n`;
        content += `Carte: ${zReportData.cardTotal.toFixed(2)} TND\n`;
        content += `Crédit: ${zReportData.creditTotal.toFixed(2)} TND\n\n`;
        
        content += '-------------------------------------------------------\n';
        content += 'VENTES PAR CATÉGORIE\n';
        content += '-------------------------------------------------------\n';
        if (Object.keys(zReportData.salesByCategory).length > 0) {
            // FIX: Use Object.keys to avoid type inference issues with Object.entries
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
            // FIX: Use Object.keys to avoid type inference issues with Object.entries
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
                        <h3>Ventes par catégorie:</h3>
                        <ul>
                            ${Object.keys(zReportData.salesByCategory).length > 0 ? Object.entries(zReportData.salesByCategory).map(([category, total]) => `
                                <li>${category}: ${total.toFixed(2)} TND</li>
                            `).join('') : '<li>Aucune vente.</li>'}
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
                            ${Object.entries(zReportData.monthlyItemsSummary).map(([name, data]) => `
                                 <tr>
                                    <td>${name}</td>
                                    <td class="text-center">${data.quantity}</td>
                                    <td class="text-right">${data.total.toFixed(2)} TND</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </body>
            </html>
        `;
        printHTMLContent(printContent);
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
        setPasswordMessage({ type: '', text: '' }); // Clear message on new input
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
                 setPasswordMessage({ type: 'error', text: 'Erreur lors de la sauvegarde du mot de passe.' });
            }
        }
    };
    
    const handleEmailFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setRecipientEmail(e.target.value);
        setEmailMessage({ type: '', text: '' });
    };

    const handleSubmitNewEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        setEmailMessage({ type: '', text: '' });

        if (!/^\S+@\S+\.\S+$/.test(recipientEmail)) {
            setEmailMessage({ type: 'error', text: 'Veuillez entrer une adresse e-mail valide.' });
            return;
        }

        if (onRecipientEmailChange) {
            try {
                await onRecipientEmailChange(recipientEmail);
                setEmailMessage({ type: 'success', text: 'Adresse e-mail mise à jour avec succès !' });
            } catch (error) {
                setEmailMessage({ type: 'error', text: 'Erreur lors de la sauvegarde de l\'e-mail.' });
            }
        }
    };

    const renderProducts = () => (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">Gestion des Articles</h3>
                <button onClick={openAddProductModal} className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600">Ajouter un produit</button>
            </div>
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="grid grid-cols-4 font-bold p-3 bg-gray-50 border-b">
                    <div>Nom</div>
                    <div>Catégorie</div>
                    <div>Prix</div>
                    <div>Actions</div>
                </div>
                <div className="divide-y divide-gray-200 max-h-[60vh] overflow-y-auto">
                {appData.products.map(product => {
                    const category = appData.categories.find(c => c.id === product.categoryId);
                    return (
                        <div key={product.id} className="grid grid-cols-4 p-3 items-center">
                            <div>{product.name}</div>
                            <div>{category?.name || 'N/A'}</div>
                            <div>{product.price.toFixed(2)} TND</div>
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
                    <div>Actions</div>
                </div>
                <div className="divide-y divide-gray-200 max-h-[60vh] overflow-y-auto">
                {appData.categories.map(category => (
                    <div key={category.id} className="grid grid-cols-2 p-3 items-center">
                        <div>{category.name}</div>
                        <div className="flex gap-2">
                            <button onClick={() => openEditCategoryModal(category)} className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600">Modifier</button>
                            <button onClick={() => requestDeleteCategory(category)} className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600">Supprimer</button>
                        </div>
                    </div>
                ))}
                </div>
            </div>
        </div>
    );

    const renderSales = () => {
        return (
             <div>
                <h3 className="text-xl font-semibold mb-4">Ventes Détaillées par Article (Journée complète)</h3>
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <label htmlFor="salesDate" className="font-medium">Date des ventes: </label>
                        <input type="date" id="salesDate" value={salesDate} onChange={e => setSalesDate(e.target.value)} className="p-2 border rounded-md"/>
                    </div>
                    <div className="flex gap-2">
                        <button 
                            onClick={handleCloseRegister}
                            disabled={unclosedSalesForDay.length === 0}
                            className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:bg-gray-400"
                        >
                            Clôturer la caisse
                        </button>
                        <button onClick={handlePrintSales} className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600">Imprimer</button>
                    </div>
                </div>
                 <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="grid grid-cols-3 font-bold p-3 bg-gray-50 border-b">
                        <div>Article</div>
                        <div className="text-center">Quantité</div>
                        <div className="text-right">Total</div>
                    </div>
                    <div className="divide-y divide-gray-200 max-h-[40vh] overflow-y-auto">
                        {Object.keys(dailyReportData.items).length > 0 ? (
                            // FIX: Use Object.keys to avoid type inference issues with Object.entries
                            Object.keys(dailyReportData.items).map((name) => {
                                const data = dailyReportData.items[name];
                                return (
                                <div key={name} className="grid grid-cols-3 p-3 items-center">
                                    <div>{name}</div>
                                    <div className="text-center">{data.quantity}</div>
                                    <div className="text-right font-medium">{data.total.toFixed(2)} TND</div>
                                </div>
                            )})
                        ) : (
                            <p className="p-4 text-gray-500">Aucune vente enregistrée pour cette date.</p>
                        )}
                    </div>
                    {Object.keys(dailyReportData.items).length > 0 && (
                        <div className="font-bold p-3 bg-gray-100 border-t text-lg">
                            <div className="grid grid-cols-3">
                               <div>Total Général</div>
                               <div></div>
                               <div className="text-right">{dailyReportData.grandTotal.toFixed(2)} TND</div>
                            </div>
                            <div className="grid grid-cols-3 mt-2 pt-2 border-t border-gray-300 text-base">
                               <div>Détail Paiements:</div>
                               <div></div>
                               <div className="text-right">
                                    <div>Espèces: {dailyReportData.cashTotal.toFixed(2)} TND</div>
                                    <div>Carte: {dailyReportData.cardTotal.toFixed(2)} TND</div>
                                    <div>Crédit: {dailyReportData.creditTotal.toFixed(2)} TND</div>
                               </div>
                            </div>
                        </div>
                    )}
                </div>

                {closingsForDay.length > 0 && (
                    <div className="mt-6">
                        <h3 className="text-lg font-semibold mb-3">Clôtures de la journée</h3>
                        <div className="bg-white rounded-lg shadow overflow-hidden">
                             <div className="grid grid-cols-3 font-bold p-3 bg-gray-50 border-b">
                                <div>Rapport</div>
                                <div className="text-center">Total</div>
                                <div className="text-right">Action</div>
                            </div>
                            <div className="divide-y divide-gray-200">
                                {closingsForDay.map(report => (
                                    <div key={report.id} className="grid grid-cols-3 p-3 items-center">
                                        <div className="font-semibold">Clôture N°{report.sequence}</div>
                                        <div className="text-center font-bold">{report.total.toFixed(2)} TND</div>
                                        <div className="text-right">
                                            <button onClick={() => printClosingReport(report)} className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600">
                                                Réimprimer
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };
    
    const renderZReport = () => (
         <div>
            <h3 className="text-xl font-semibold mb-4">Rapport Z</h3>
             <div className="flex justify-between items-center mb-4">
                <div>
                    <label htmlFor="zReportMonth" className="font-medium">Mois du rapport: </label>
                    <input type="month" id="zReportMonth" value={zReportMonth} onChange={e => setZReportMonth(e.target.value)} className="p-2 border rounded-md"/>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleExportZReportTxt} className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600">Exporter TXT</button>
                    <button onClick={handlePrintZReport} className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600">Imprimer</button>
                </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4 mb-6">
                <h4 className="font-bold text-lg mb-2">Résumé pour {new Date(zReportMonth + '-02').toLocaleString('default', { month: 'long', year: 'numeric' })}</h4>
                <p><strong>Nombre total de transactions:</strong> {zReportData.count}</p>
                <p className="text-xl font-bold my-2"><strong>Chiffre d'affaires total:</strong> {zReportData.totalSales.toFixed(2)} TND</p>
                <h5 className="font-semibold mt-4 mb-2">Ventes par catégorie:</h5>
                {Object.keys(zReportData.salesByCategory).length > 0 ? (
                    <ul className="list-disc pl-5">
                        {/* FIX: Use Object.keys to avoid type inference issues with Object.entries */}
                        {Object.keys(zReportData.salesByCategory).map((category) => {
                            const total = zReportData.salesByCategory[category];
                            return <li key={category}>{category}: {total.toFixed(2)} TND</li>
                        })}
                    </ul>
                ) : <p className="text-gray-500">Aucune vente ce mois-ci.</p>}
                
                <h5 className="font-semibold mt-4 mb-2">Ventes par mode de paiement:</h5>
                 <ul className="list-disc pl-5">
                    <li>Espèces: {zReportData.cashTotal.toFixed(2)} TND</li>
                    <li>Carte: {zReportData.cardTotal.toFixed(2)} TND</li>
                    <li>Crédit: {zReportData.creditTotal.toFixed(2)} TND</li>
                </ul>

            </div>

            <div className="bg-white rounded-lg shadow">
                <h5 className="font-semibold p-4 border-b">Détail des articles vendus ce mois-ci:</h5>
                <div className="grid grid-cols-3 font-bold p-3 bg-gray-50 border-b">
                    <div>Article</div>
                    <div className="text-center">Quantité</div>
                    <div className="text-right">Total</div>
                </div>
                 <div className="divide-y divide-gray-200 max-h-[40vh] overflow-y-auto">
                     {Object.keys(zReportData.monthlyItemsSummary).length > 0 ? (
                        // FIX: Use Object.keys to avoid type inference issues with Object.entries
                        Object.keys(zReportData.monthlyItemsSummary).map((name) => {
                            const data = zReportData.monthlyItemsSummary[name];
                            return (
                            <div key={name} className="grid grid-cols-3 p-3 items-center">
                                <div>{name}</div>
                                <div className="text-center">{data.quantity}</div>
                                <div className="text-right font-medium">{data.total.toFixed(2)} TND</div>
                            </div>
                        )})
                    ) : (
                        <p className="p-4 text-gray-500">Aucun article vendu ce mois-ci.</p>
                    )}
                </div>
            </div>
        </div>
    );
    
    const renderSettings = () => (
        <div>
            <h3 className="text-xl font-semibold mb-4">Paramètres Généraux</h3>
            <div className="bg-white rounded-lg shadow p-6">
                <h4 className="font-bold text-lg mb-3">Image de fond de l'accueil</h4>
                <div className="flex items-center gap-6">
                    <div>
                        <label htmlFor="bg-upload" className="cursor-pointer px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600">
                            Changer l'image
                        </label>
                        <input id="bg-upload" type="file" accept="image/*" className="hidden" onChange={handleBackgroundImageChange} />
                    </div>
                    {appData.backgroundImage && (
                        <button onClick={removeBackgroundImage} className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600">
                           Supprimer l'image
                        </button>
                    )}
                </div>
                {appData.backgroundImage && (
                    <div className="mt-6 border rounded-md p-2">
                         <p className="text-sm text-gray-600 mb-2">Aperçu :</p>
                         <img src={appData.backgroundImage} alt="Background Preview" className="max-w-xs rounded-md shadow-md" />
                    </div>
                )}
            </div>

            <div className="bg-white rounded-lg shadow p-6 mt-6">
                <h4 className="font-bold text-lg mb-3">E-mail de destination des rapports</h4>
                <form onSubmit={handleSubmitNewEmail} className="space-y-4 max-w-md">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Adresse e-mail</label>
                        <input
                            type="email"
                            name="email"
                            value={recipientEmail}
                            onChange={handleEmailFormChange}
                            className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                            required
                        />
                    </div>
                    {emailMessage.text && (
                        <p className={`text-sm ${emailMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                            {emailMessage.text}
                        </p>
                    )}
                    <div>
                        <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
                            Enregistrer l'e-mail
                        </button>
                    </div>
                </form>
            </div>

            <div className="bg-white rounded-lg shadow p-6 mt-6">
                <h4 className="font-bold text-lg mb-3">Changer le mot de passe administrateur</h4>
                <form onSubmit={handleSubmitNewPassword} className="space-y-4 max-w-md">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Mot de passe actuel</label>
                        <input
                            type="password"
                            name="current"
                            value={passwordChangeForm.current}
                            onChange={handlePasswordFormChange}
                            className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Nouveau mot de passe</label>
                        <input
                            type="password"
                            name="newPass"
                            value={passwordChangeForm.newPass}
                            onChange={handlePasswordFormChange}
                            className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Confirmer le nouveau mot de passe</label>
                        <input
                            type="password"
                            name="confirmPass"
                            value={passwordChangeForm.confirmPass}
                            onChange={handlePasswordFormChange}
                            className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                            required
                        />
                    </div>
                    {passwordMessage.text && (
                        <p className={`text-sm ${passwordMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                            {passwordMessage.text}
                        </p>
                    )}
                    <div>
                        <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
                            Changer le mot de passe
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-gray-100 z-50 p-6 overflow-y-auto">
            <div className="admin-header flex justify-between items-center pb-4 border-b mb-6">
                <h2 className="text-3xl font-bold">Administration</h2>
                <button onClick={closePanel} className="px-4 py-2 bg-slate-600 text-white rounded-md hover:bg-slate-700">Fermer</button>
            </div>
            <div className="flex gap-2 mb-6 border-b">
                {(['sales', 'products', 'categories', 'z-report', 'settings'] as AdminTab[]).map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded-t-md font-semibold capitalize ${activeTab === tab ? 'bg-white border border-b-0' : 'bg-gray-200'}`}>
                        {tab === 'products' ? 'Articles' : tab === 'categories' ? 'Catégories' : tab === 'sales' ? 'Ventes' : tab === 'z-report' ? 'Rapport Z' : 'Paramètres'}
                    </button>
                ))}
            </div>
            
            <div className="admin-content">
                {activeTab === 'products' && renderProducts()}
                {activeTab === 'categories' && renderCategories()}
                {activeTab === 'sales' && renderSales()}
                {activeTab === 'z-report' && renderZReport()}
                {activeTab === 'settings' && renderSettings()}
            </div>

            <Modal title={editingProduct ? "Modifier le produit" : "Ajouter un produit"} isOpen={isProductModalOpen} onClose={() => setProductModalOpen(false)}>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium">Nom</label>
                        <input type="text" name="name" value={productForm.name} onChange={handleProductFormChange} className="w-full px-3 py-2 border rounded-md" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Prix (TND)</label>
                        <input type="number" name="price" value={productForm.price} onChange={handleProductFormChange} className="w-full px-3 py-2 border rounded-md" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Catégorie</label>
                        <select name="categoryId" value={productForm.categoryId} onChange={handleProductFormChange} className="w-full px-3 py-2 border rounded-md bg-white">
                            {appData.categories.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                    <button onClick={() => setProductModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300">{editingProduct ? "Fermer" : "Annuler"}</button>
                    {!editingProduct && (
                        <button onClick={handleSaveProduct} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Sauvegarder</button>
                    )}
                </div>
            </Modal>
            
            <Modal title="Confirmer la suppression" isOpen={!!productToDelete} onClose={() => setProductToDelete(null)}>
                <p className="text-gray-700">
                    Êtes-vous sûr de vouloir supprimer le produit <strong>{productToDelete?.name}</strong> ? Cette action est irréversible.
                </p>
                <div className="mt-6 flex justify-end gap-3">
                    <button onClick={() => setProductToDelete(null)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">
                        Annuler
                    </button>
                    <button onClick={handleConfirmDelete} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">
                        Confirmer
                    </button>
                </div>
            </Modal>
            
            <Modal title={editingCategory ? "Modifier la catégorie" : "Ajouter une catégorie"} isOpen={isCategoryModalOpen} onClose={() => setCategoryModalOpen(false)}>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium">Nom</label>
                        <input 
                            type="text" 
                            name="name" 
                            value={categoryForm.name} 
                            onChange={(e) => setCategoryForm({ name: e.target.value })} 
                            className="w-full px-3 py-2 border rounded-md" 
                            autoFocus
                        />
                    </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                    <button onClick={() => setCategoryModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300">Annuler</button>
                    <button onClick={handleSaveCategory} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Sauvegarder</button>
                </div>
            </Modal>

            <Modal title="Confirmer la suppression" isOpen={!!categoryToDelete} onClose={() => setCategoryToDelete(null)}>
                <p className="text-gray-700">
                    Êtes-vous sûr de vouloir supprimer la catégorie <strong>{categoryToDelete?.name}</strong> ? Cette action est irréversible.
                </p>
                <div className="mt-6 flex justify-end gap-3">
                    <button onClick={() => setCategoryToDelete(null)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">
                        Annuler
                    </button>
                    <button onClick={handleConfirmDeleteCategory} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">
                        Confirmer
                    </button>
                </div>
            </Modal>
        </div>
    );
};

export default AdminPanel;