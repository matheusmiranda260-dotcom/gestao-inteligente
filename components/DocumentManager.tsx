import React, { useState, useEffect, useRef } from 'react';
import type { Page, Document, User } from '../types';
import { 
    PlusIcon, 
    SearchIcon, 
    TrashIcon, 
    PrinterIcon, 
    DocumentTextIcon, 
    ArrowLeftIcon,
    DownloadIcon,
    FilterIcon,
    XIcon,
    SaveIcon
} from './icons';
import { fetchTable, insertItem, deleteItem, uploadFile } from '../services/supabaseService';

interface DocumentManagerProps {
    setPage: (page: Page) => void;
    currentUser: User | null;
}

const DocumentManager: React.FC<DocumentManagerProps> = ({ setPage, currentUser }) => {
    const [documents, setDocuments] = useState<Document[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('Todos');
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [uploading, setUploading] = useState(false);
    
    // New Document Form State
    const [newDocTitle, setNewDocTitle] = useState('');
    const [newDocCategory, setNewDocCategory] = useState('Ficha Técnica');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const categories = ['Todos', 'Ficha Técnica', 'Certificado', 'Procedimento', 'Contrato', 'Outros'];

    useEffect(() => {
        loadDocuments();
    }, []);

    const loadDocuments = async () => {
        setLoading(true);
        try {
            const data = await fetchTable<Document>('company_documents');
            // Sort by date descending
            setDocuments(data.sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime()));
        } catch (error) {
            console.error('Error loading documents:', error);
            // Table might not exist yet, we'll handle gracefully
        }
        setLoading(false);
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedFile || !newDocTitle) return;

        setUploading(true);
        try {
            const fileName = `docs/${Date.now()}_${selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
            const publicUrl = await uploadFile('kb-files', fileName, selectedFile);

            if (publicUrl) {
                const newDoc: Document = {
                    id: `doc-${Date.now()}`,
                    title: newDocTitle,
                    category: newDocCategory,
                    url: publicUrl,
                    createdAt: new Date().toISOString(),
                    author: currentUser?.username || 'Sistema',
                    fileType: selectedFile.type
                };

                await insertItem('company_documents', newDoc);
                setDocuments([newDoc, ...documents]);
                setIsUploadModalOpen(false);
                setNewDocTitle('');
                setSelectedFile(null);
                alert('Documento enviado com sucesso!');
            }
        } catch (error) {
            console.error('Upload error:', error);
            alert('Erro ao enviar documento. Verifique a tabela company_documents.');
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Deseja realmente excluir este documento?')) return;
        try {
            await deleteItem('company_documents', id);
            setDocuments(documents.filter(d => d.id !== id));
        } catch (error) {
            alert('Erro ao excluir documento.');
        }
    };

    const handlePrint = (url: string) => {
        const win = window.open(url, '_blank');
        if (win) {
            win.focus();
            // Printing automatically is hard for PDFs in some browsers, 
            // but opening in a new tab is the standard "easy access for printing"
        }
    };

    const filteredDocuments = documents.filter(doc => {
        const matchesSearch = doc.title.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = categoryFilter === 'Todos' || doc.category === categoryFilter;
        return matchesSearch && matchesCategory;
    });

    return (
        <div className="min-h-screen bg-[#F8FAFC]">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-30">
                <div className="flex items-center gap-4">
                    <button onClick={() => setPage('menu')} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">
                        <ArrowLeftIcon className="h-6 w-6" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Documentos e Arquivos</h1>
                        <p className="text-sm text-slate-500">Central de arquivos para consulta e impressão</p>
                    </div>
                </div>
                <button 
                    onClick={() => setIsUploadModalOpen(true)}
                    className="bg-[#0F3F5C] hover:bg-[#1e4e6d] text-white px-6 py-2 rounded-xl font-bold shadow-lg shadow-blue-900/10 flex items-center gap-2 transition-all transform hover:scale-105"
                >
                    <PlusIcon className="h-5 w-5" />
                    Novo Documento
                </button>
            </header>

            <div className="p-6 max-w-7xl mx-auto">
                {/* Search and Filters */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-8 flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="relative w-full md:w-96">
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                        <input 
                            type="text"
                            placeholder="Buscar documentos..."
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto no-scrollbar pb-1 md:pb-0">
                        <FilterIcon className="h-5 w-5 text-slate-400 mr-2 shrink-0" />
                        {categories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setCategoryFilter(cat)}
                                className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all whitespace-nowrap ${
                                    categoryFilter === cat 
                                    ? 'bg-blue-600 text-white shadow-md' 
                                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Grid */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                        <p className="mt-4 text-slate-500 font-medium">Carregando documentos...</p>
                    </div>
                ) : filteredDocuments.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {filteredDocuments.map(doc => (
                            <div key={doc.id} className="group bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all overflow-hidden flex flex-col">
                                <div className="p-5 flex-1">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="h-12 w-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                                            <DocumentTextIcon className="h-7 w-7" />
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button 
                                                onClick={() => handlePrint(doc.url)}
                                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                                                title="Imprimir / Abrir"
                                            >
                                                <PrinterIcon className="h-5 w-5" />
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(doc.id)}
                                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                                                title="Excluir"
                                            >
                                                <TrashIcon className="h-5 w-5" />
                                            </button>
                                        </div>
                                    </div>
                                    <h3 className="font-bold text-slate-800 line-clamp-2 leading-tight mb-2 h-10">{doc.title}</h3>
                                    <div className="flex items-center gap-2 mb-4">
                                        <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 bg-slate-100 text-slate-500 rounded">
                                            {doc.category}
                                        </span>
                                    </div>
                                </div>
                                <div className="bg-slate-50 px-5 py-3 border-t border-slate-100 flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-slate-400 uppercase font-bold">Adicionado por</span>
                                        <span className="text-xs font-bold text-slate-600">{doc.author}</span>
                                    </div>
                                    <span className="text-xs text-slate-400">
                                        {new Date(doc.createdAt || '').toLocaleDateString()}
                                    </span>
                                </div>
                                <button 
                                    onClick={() => handlePrint(doc.url)}
                                    className="w-full py-3 bg-[#0F3F5C] text-white font-bold text-sm hover:bg-[#1e4e6d] transition-colors flex items-center justify-center gap-2"
                                >
                                    <PrinterIcon className="h-4 w-4" />
                                    Acessar para Impressão
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                        <div className="h-20 w-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <DocumentTextIcon className="h-10 w-10 text-slate-300" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-700">Nenhum documento encontrado</h3>
                        <p className="text-slate-500 mt-2">Personalize seus filtros ou adicione novos arquivos.</p>
                        <button 
                            onClick={() => setIsUploadModalOpen(true)}
                            className="mt-6 text-blue-600 font-bold hover:underline"
                        >
                            Adicionar meu primeiro documento
                        </button>
                    </div>
                )}
            </div>

            {/* Upload Modal */}
            {isUploadModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <h2 className="text-xl font-bold text-slate-800">Novo Documento</h2>
                            <button onClick={() => setIsUploadModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                                <XIcon className="h-6 w-6 text-slate-400" />
                            </button>
                        </div>
                        <form onSubmit={handleUpload} className="p-6 space-y-5">
                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Título do Documento</label>
                                <input 
                                    type="text"
                                    placeholder="Ex: Tabela de Pesos CA-60"
                                    required
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                                    value={newDocTitle}
                                    onChange={(e) => setNewDocTitle(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Categoria</label>
                                <select 
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                                    value={newDocCategory}
                                    onChange={(e) => setNewDocCategory(e.target.value)}
                                >
                                    {categories.filter(c => c !== 'Todos').map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Arquivo (PDF recomendado)</label>
                                <div 
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`mt-1 border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all ${
                                        selectedFile 
                                        ? 'border-green-400 bg-green-50' 
                                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-blue-300'
                                    }`}
                                >
                                    {selectedFile ? (
                                        <>
                                            <div className="h-12 w-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-2">
                                                <SaveIcon className="h-6 w-6" />
                                            </div>
                                            <p className="text-sm font-bold text-green-700 text-center truncate w-full px-4">{selectedFile.name}</p>
                                            <p className="text-[10px] text-green-600 uppercase font-black mt-1">Arquivo selecionado</p>
                                        </>
                                    ) : (
                                        <>
                                            <div className="h-12 w-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mb-2">
                                                <PlusIcon className="h-6 w-6" />
                                            </div>
                                            <p className="text-sm font-bold text-slate-500">Clique para selecionar</p>
                                            <p className="text-[10px] text-slate-400 uppercase font-black mt-1">PDF, JPG ou PNG</p>
                                        </>
                                    )}
                                    <input 
                                        type="file" 
                                        ref={fileInputRef} 
                                        className="hidden" 
                                        onChange={(e) => setSelectedFile(e.target.files ? e.target.files[0] : null)}
                                    />
                                </div>
                            </div>
                            
                            <button 
                                type="submit"
                                disabled={uploading || !selectedFile || !newDocTitle}
                                className="w-full py-4 bg-[#0F3F5C] text-white rounded-2xl font-bold shadow-xl shadow-blue-900/20 disabled:opacity-50 disabled:shadow-none transition-all flex items-center justify-center gap-2"
                            >
                                {uploading ? (
                                    <>
                                        <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        Enviando...
                                    </>
                                ) : (
                                    <>
                                        <DownloadIcon className="h-5 w-5" />
                                        Salvar Documento
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DocumentManager;
