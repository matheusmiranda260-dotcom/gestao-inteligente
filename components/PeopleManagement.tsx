import React, { useState, useEffect } from 'react';
import { ArrowLeftIcon, PlusIcon, StarIcon, ChartBarIcon, TrophyIcon, SearchIcon, FilterIcon, UserIcon, BookOpenIcon, ClockIcon, DocumentTextIcon, PencilIcon, TrashIcon, UserGroupIcon, ExclamationIcon, SaveIcon, XIcon, DownloadIcon, PrinterIcon } from './icons';
import type { Page, Employee, Evaluation, Achievement, User, EmployeeCourse, EmployeeAbsence, EmployeeVacation, EmployeeResponsibility, OrgUnit, OrgPosition, EmployeeDocument } from '../types';
import { fetchTable, insertItem, updateItem, deleteItem, fetchByColumn, uploadFile } from '../services/supabaseService';

interface PeopleManagementProps {
    setPage: (page: Page) => void;
    currentUser: User | null;
}

// --- DASHBOARD COMPONENT ---
const DashboardRH: React.FC<{ employees: Employee[], absences: EmployeeAbsence[], vacations: EmployeeVacation[] }> = ({ employees, absences, vacations }) => {
    const totalEmployees = employees.length;
    const activeEmployees = employees.filter(e => e.active).length;
    const inactiveEmployees = totalEmployees - activeEmployees;

    // Simple analysis
    const currentlyOnVacation = vacations.filter(v => {
        const now = new Date();
        return new Date(v.startDate) <= now && new Date(v.endDate) >= now;
    }).length;

    const recentAbsences = absences.length; // Could filter by date

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-bold text-slate-500 uppercase">Total Colaboradores</p>
                        <p className="text-3xl font-bold text-[#0F3F5C]">{totalEmployees}</p>
                    </div>
                    <UserGroupIcon className="h-10 w-10 text-slate-200" />
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-bold text-slate-500 uppercase">Ativos</p>
                        <p className="text-3xl font-bold text-green-600">{activeEmployees}</p>
                    </div>
                    <UserIcon className="h-10 w-10 text-green-100" />
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-bold text-slate-500 uppercase">Em Férias (Hoje)</p>
                        <p className="text-3xl font-bold text-blue-600">{currentlyOnVacation}</p>
                    </div>
                    <ClockIcon className="h-10 w-10 text-blue-100" />
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-bold text-slate-500 uppercase">Faltas/Ausências</p>
                        <p className="text-3xl font-bold text-red-500">{recentAbsences}</p>
                    </div>
                    <ExclamationIcon className="h-10 w-10 text-red-100" />
                </div>
            </div>

            {/* Graphs / Lists could go here */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <h3 className="font-bold text-slate-700 mb-4">Colaboradores em Férias</h3>
                {vacations.filter(v => new Date(v.endDate) >= new Date()).length > 0 ? (
                    <table className="w-full text-sm">
                        <thead className="text-left bg-slate-50 text-slate-500 uppercase text-xs">
                            <tr><th className="p-2">Colaborador</th><th className="p-2">Início</th><th className="p-2">Fim</th></tr>
                        </thead>
                        <tbody>
                            {vacations.filter(v => new Date(v.endDate) >= new Date()).map(v => {
                                const emp = employees.find(e => e.id === v.employeeId);
                                return (
                                    <tr key={v.id} className="border-b">
                                        <td className="p-2 font-bold">{emp?.name || 'Desconhecido'}</td>
                                        <td className="p-2">{new Date(v.startDate).toLocaleDateString()}</td>
                                        <td className="p-2">{new Date(v.endDate).toLocaleDateString()}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                ) : <p className="text-slate-400">Ninguém em férias no momento.</p>}
            </div>
        </div>
    );
};


// ... StarRating Component (Same as before) ...
const StarRating: React.FC<{ score: number; onChange?: (score: number) => void; max?: number; readonly?: boolean }> = ({ score, onChange, max = 5, readonly = false }) => {
    return (
        <div className="flex space-x-1">
            {Array.from({ length: max }).map((_, i) => (
                <button
                    key={i}
                    type="button"
                    onClick={() => !readonly && onChange && onChange(i + 1)}
                    className={`${readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110 transition-transform'}`}
                    disabled={readonly}
                >
                    <StarIcon
                        className={`h-6 w-6 ${i < score ? 'text-yellow-400 fill-current' : 'text-gray-300'}`}
                    />
                </button>
            ))}
        </div>
    );
};

// ... EmployeeCard Component (Same as before) ...
const EmployeeCard: React.FC<{ employee: Employee; onSelect: () => void; onDelete: () => void; evaluations: Evaluation[] }> = ({ employee, onSelect, onDelete, evaluations }) => {
    const employeeEvals = evaluations.filter(e => e.employeeId === employee.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const lastEvaluation = employeeEvals[0];
    const displayScore = lastEvaluation ? (lastEvaluation.totalScore / 5) : 0;

    return (
        <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all border border-slate-100 p-4 flex items-center space-x-4 relative group">
            <div onClick={onSelect} className="flex-grow flex items-center space-x-4 cursor-pointer">
                <div className="h-16 w-16 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden border-2 border-slate-100 shrink-0">
                    {employee.photoUrl ? (
                        <img src={employee.photoUrl} alt={employee.name} className="h-full w-full object-cover" />
                    ) : (
                        <span className="text-2xl font-bold text-slate-400">{employee.name.charAt(0)}</span>
                    )}
                </div>
                <div className="flex-grow min-w-0">
                    <h3 className="font-bold text-slate-800 truncate">{employee.name}</h3>
                    <p className="text-sm text-slate-500 truncate">{employee.sector} • {employee.shift}</p>
                    {employee.jobTitle && <p className="text-xs text-slate-400 truncate">{employee.jobTitle}</p>}
                    <div className="flex items-center mt-1">
                        <StarIcon className="h-4 w-4 text-yellow-400 fill-current mr-1" />
                        <span className="font-bold text-slate-700">{displayScore.toFixed(1)}</span>
                        <span className="text-xs text-slate-400 ml-2">({employeeEvals.length} avaliações)</span>
                    </div>
                </div>
            </div>
            <div className="flex flex-col gap-2">
                <button onClick={onSelect} className="text-blue-500 hover:text-blue-700">
                    <ChartBarIcon className="h-6 w-6" />
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                    className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Excluir Funcionário"
                >
                    <TrashIcon className="h-5 w-5" />
                </button>
            </div>
        </div>
    );
};


// ... EmployeeDetailModal (Same as before) ...
const EmployeeDetailModal: React.FC<{
    employee: Employee;
    onClose: () => void;
    onSave: () => void;
    onDelete: () => void; // New prop
    currentUser: User | null;
}> = ({ employee, onClose, onSave, onDelete, currentUser }) => {
    // ... Copy existing implementation or use a placeholder if too long (I'll keep it shortened for this specific file write as the focus is Organograma)
    // To ensure I don't break existing features, I will replicate it or assume it's there. 
    // Given the previous step saw the full file, I will perform a full overwrite including the Modal code to be safe.

    const [activeTab, setActiveTab] = useState<'profile' | 'responsibilities' | 'development' | 'hr' | 'evaluations' | 'documents'>('profile');
    const [empData, setEmpData] = useState<Employee>(employee);
    const [responsibilities, setResponsibilities] = useState<EmployeeResponsibility[]>([]);
    const [courses, setCourses] = useState<EmployeeCourse[]>([]);
    const [absences, setAbsences] = useState<EmployeeAbsence[]>([]);
    const [vacations, setVacations] = useState<EmployeeVacation[]>([]);
    const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
    const [newResp, setNewResp] = useState('');
    const [newCourse, setNewCourse] = useState('');
    const [isEvaluating, setIsEvaluating] = useState(false);
    const [evalScores, setEvalScores] = useState({ organization: 0, cleanliness: 0, effort: 0, communication: 0, improvement: 0 });
    const [evalNote, setEvalNote] = useState('');

    // Documents State
    const [documents, setDocuments] = useState<EmployeeDocument[]>([]);

    // Development Form State
    const [newCourseData, setNewCourseData] = useState<{
        educationType: 'Escolaridade' | 'Graduação' | 'Pós-Graduação' | 'Técnico' | 'Curso Livre' | 'Certificação';
        courseName: string;
        institution: string;
        completionDate: string;
        workloadHours: string;
    }>({ educationType: 'Curso Livre', courseName: '', institution: '', completionDate: '', workloadHours: '' });
    const [courseFile, setCourseFile] = useState<File | null>(null);
    // HR Form State

    // HR Form State
    const [newAbsence, setNewAbsence] = useState({ type: 'Falta Injustificada', startDate: '', endDate: '', reason: '' });
    const [absenceFile, setAbsenceFile] = useState<File | null>(null);
    const [newVacation, setNewVacation] = useState({ period: '', startDate: '', endDate: '' });

    // Handlers for HR
    const handleAddAbsence = async () => {
        if (!newAbsence.startDate) return;
        try {
            let attachmentUrl = null;

            if (absenceFile) {
                const fileName = `absences/${employee.id}_${Date.now()}_${absenceFile.name}`;
                attachmentUrl = await uploadFile('kb-files', fileName, absenceFile);
            }

            await insertItem('employee_absences', {
                employeeId: employee.id,
                type: newAbsence.type,
                startDate: newAbsence.startDate,
                endDate: newAbsence.endDate || null,
                reason: newAbsence.reason,
                attachmentUrl: attachmentUrl
            });
            alert('Ausência registrada');
            setNewAbsence({ type: 'Falta Injustificada', startDate: '', endDate: '', reason: '' });
            setAbsenceFile(null);
            loadDetails();
        } catch (e) { alert('Erro ao registrar ausência'); }
    };

    const handleDeleteAbsence = async (id: string) => {
        if (!confirm('Excluir registro?')) return;
        await deleteItem('employee_absences', id);
        loadDetails();
    };

    const handleAddVacation = async () => {
        if (!newVacation.startDate || !newVacation.endDate) return;
        try {
            await insertItem('employee_vacations', {
                employeeId: employee.id,
                period: newVacation.period,
                startDate: newVacation.startDate,
                endDate: newVacation.endDate,
                status: 'Agendada'
            });
            alert('Férias agendadas');
            setNewVacation({ period: '', startDate: '', endDate: '' });
            loadDetails();
        } catch (e) { alert('Erro ao registrar férias'); }
    };

    const handleDeleteVacation = async (id: string) => {
        if (!confirm('Excluir registro?')) return;
        await deleteItem('employee_vacations', id);
        loadDetails();
    };

    // Document Handlers
    const handleUploadDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];

        try {
            // Upload to Supabase bucket 'kb-files'
            const fileName = `emp_docs/${employee.id}_${Date.now()}_${file.name}`;
            const publicUrl = await uploadFile('kb-files', fileName, file);

            if (publicUrl) {
                await insertItem('employee_documents', {
                    employeeId: employee.id,
                    title: file.name,
                    type: 'Documento', // Could be refined
                    url: publicUrl
                });
                alert('Documento anexado com sucesso!');
                loadDetails();
            }
        } catch (error) {
            console.error(error);
            alert('Erro ao enviar arquivo. Verifique se o Bucket "kb-files" existe.');
        }
    };

    const handleDeleteDocument = async (id: string) => {
        if (!confirm('Remover este documento?')) return;
        await deleteItem('employee_documents', id);
        loadDetails();
    };

    const handleUpdatePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        try {
            const fileName = `avatars/${employee.id}_${Date.now()}_${file.name}`;
            const publicUrl = await uploadFile('kb-files', fileName, file);
            if (publicUrl) {
                const updated = await updateItem('employees', employee.id, { photoUrl: publicUrl });
                setEmpData({ ...empData, photoUrl: publicUrl });
                alert('Foto atualizada!');
            }
        } catch (error) { alert('Erro ao atualizar foto.'); }
    };

    const handlePrintProfile = () => {
        // Simple print: open a new window with formatted content or use CSS print media queries on the modal
        // For simplicity, we'll suggest using browser print on a clean view, but opening a new window is cleaner
        window.print();
    };

    useEffect(() => { loadDetails(); }, [employee.id]);

    const loadDetails = async () => {
        try {
            const [resps, crs, abs, vacs, evals] = await Promise.all([
                fetchByColumn<EmployeeResponsibility>('employee_responsibilities', 'employee_id', employee.id),
                fetchByColumn<EmployeeCourse>('employee_courses', 'employee_id', employee.id),
                fetchByColumn<EmployeeAbsence>('employee_absences', 'employee_id', employee.id),
                fetchByColumn<EmployeeVacation>('employee_vacations', 'employee_id', employee.id),
                fetchByColumn<Evaluation>('evaluations', 'employee_id', employee.id)
            ]);
            setResponsibilities(resps);
            setCourses(crs);
            setAbsences(abs);
            setVacations(vacs);

            // Fetch Documents
            const docs = await fetchByColumn<EmployeeDocument>('employee_documents', 'employee_id', employee.id);
            setDocuments(docs || []);

            // Load HR Data
            const absencesData = await fetchByColumn<EmployeeAbsence>('employee_absences', 'employee_id', employee.id);
            const vacationsData = await fetchByColumn<EmployeeVacation>('employee_vacations', 'employee_id', employee.id);
            if (absencesData) setAbsences(absencesData);
            if (vacationsData) setVacations(vacationsData);

            setEvaluations(evals.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        } catch (e) {
            console.error("Error loading employee details", e);
        }
    };

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await updateItem('employees', empData.id, empData);
            alert('Perfil atualizado!');
            onSave();
        } catch (error) { alert('Erro ao atualizar perfil.'); }
    };

    // ... Handlers for tabs ...
    const handleAddResponsibility = async () => {
        if (!newResp) return;
        try {
            const added = await insertItem<EmployeeResponsibility>('employee_responsibilities', {
                employeeId: employee.id, description: newResp, isCritical: false
            } as EmployeeResponsibility);
            setResponsibilities([...responsibilities, added]);
            setNewResp('');
        } catch (e) { alert('Erro ao adicionar'); }
    };

    const handleDeleteResponsibility = async (id: string) => {
        if (!confirm('Remover?')) return;
        await deleteItem('employee_responsibilities', id);
        setResponsibilities(responsibilities.filter(r => r.id !== id));
    };

    const handleAddCourse = async () => {
        if (!newCourse) return;
        try {
            const added = await insertItem<EmployeeCourse>('employee_courses', {
                employeeId: employee.id, courseName: newCourse, status: 'Concluído'
            } as EmployeeCourse);
            setCourses([...courses, added]);
            setNewCourse('');
        } catch (e) { alert('Erro ao adicionar curso'); }
    };

    const handleSubmitEvaluation = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser) return;
        try {
            const newEval = await insertItem<Evaluation>('evaluations', {
                employeeId: employee.id,
                evaluator: currentUser.username,
                date: new Date().toISOString(),
                organizationScore: evalScores.organization,
                cleanlinessScore: evalScores.cleanliness,
                effortScore: evalScores.effort,
                communicationScore: evalScores.communication,
                improvementScore: evalScores.improvement,
                note: evalNote
            } as Evaluation);
            setEvaluations([newEval, ...evaluations]);
            setIsEvaluating(false);
            setEvalScores({ organization: 0, cleanliness: 0, effort: 0, communication: 0, improvement: 0 });
            setEvalNote('');
            alert('Avaliação salva!');
            onSave();
        } catch (e) { alert('Erro ao salvar avaliação'); }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden">
                <div className="bg-slate-50 p-6 border-b border-slate-200 flex justify-between items-start">
                    <div className="flex items-center space-x-4">
                        <div className="h-20 w-20 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden border-4 border-white shadow-sm relative group">
                            {empData.photoUrl ? <img src={empData.photoUrl} alt={empData.name} className="h-full w-full object-cover" /> : <span className="text-3xl font-bold text-slate-400">{empData.name.charAt(0)}</span>}
                            <label className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition">
                                <PencilIcon className="text-white h-6 w-6" />
                                <input type="file" accept="image/*" className="hidden" onChange={handleUpdatePhoto} />
                            </label>
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-slate-800">{empData.name}</h2>
                            <p className="text-slate-500">{empData.sector} • {empData.shift}</p>
                            <div className="flex space-x-2 mt-2">
                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${empData.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{empData.active ? 'Ativo' : 'Inativo'}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={handlePrintProfile} className="text-blue-400 hover:text-blue-600 p-2 rounded-full hover:bg-blue-50 transition" title="Imprimir Ficha">
                            <PrinterIcon className="h-5 w-5" />
                        </button>
                        <button onClick={onDelete} className="text-red-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition" title="Excluir Este Funcionário">
                            <TrashIcon className="h-5 w-5" />
                        </button>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-200 transition">✕</button>
                    </div>
                </div>
                <div className="flex border-b border-slate-200 bg-white">
                    {[
                        { id: 'profile', label: 'Resumo / Perfil', icon: <UserIcon className="h-4 w-4" /> },
                        { id: 'responsibilities', label: 'Atribuições', icon: <DocumentTextIcon className="h-4 w-4" /> },
                        { id: 'development', label: 'Desenvolvimento', icon: <BookOpenIcon className="h-4 w-4" /> },
                        { id: 'hr', label: 'RH (Férias/Faltas)', icon: <ClockIcon className="h-4 w-4" /> },
                        { id: 'documents', label: 'Documentos', icon: <DocumentTextIcon className="h-4 w-4" /> },
                        { id: 'evaluations', label: 'Avaliações', icon: <StarIcon className="h-4 w-4" /> },
                    ].map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex items-center space-x-2 px-6 py-4 text-sm font-medium transition-colors border-b-2 ${activeTab === tab.id ? 'border-[#0F3F5C] text-[#0F3F5C] bg-slate-50' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>
                            {tab.icon} <span>{tab.label}</span>
                        </button>
                    ))}
                </div>
                <div className="flex-grow overflow-y-auto p-6 bg-slate-50">
                    {activeTab === 'profile' && (
                        <form onSubmit={handleUpdateProfile} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                                <h3 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">Dados Pessoais</h3>
                                <div className="space-y-4">
                                    <div><label className="block text-xs font-semibold text-slate-500 uppercase">Data Nascimento</label><input type="date" className="w-full mt-1 p-2 border rounded-lg" value={empData.birthDate || ''} onChange={e => setEmpData({ ...empData, birthDate: e.target.value })} /></div>
                                    <div><label className="block text-xs font-semibold text-slate-500 uppercase">Estado Civil</label><select className="w-full mt-1 p-2 border rounded-lg" value={empData.maritalStatus || ''} onChange={e => setEmpData({ ...empData, maritalStatus: e.target.value })}><option value="">Selecione</option><option value="Solteiro(a)">Solteiro(a)</option><option value="Casado(a)">Casado(a)</option><option value="Divorciado(a)">Divorciado(a)</option></select></div>
                                    <div><label className="block text-xs font-semibold text-slate-500 uppercase">Filhos</label><input type="number" className="w-full mt-1 p-2 border rounded-lg" value={empData.childrenCount || 0} onChange={e => setEmpData({ ...empData, childrenCount: parseInt(e.target.value) })} /></div>
                                    <div><label className="block text-xs font-semibold text-slate-500 uppercase">Telefone / Contato</label><input type="text" className="w-full mt-1 p-2 border rounded-lg" value={empData.phone || ''} onChange={e => setEmpData({ ...empData, phone: e.target.value })} /></div>
                                </div>
                            </div>
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                                <h3 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">Dados Profissionais</h3>
                                <div className="space-y-4">
                                    <div><label className="block text-xs font-semibold text-slate-500 uppercase">Cargo / Função</label><input type="text" className="w-full mt-1 p-2 border rounded-lg" value={empData.jobTitle || ''} onChange={e => setEmpData({ ...empData, jobTitle: e.target.value })} placeholder="Ex: Operador Trefila I" /></div>
                                    <div><label className="block text-xs font-semibold text-slate-500 uppercase">Data Admissão</label><input type="date" className="w-full mt-1 p-2 border rounded-lg" value={empData.admissionDate || ''} onChange={e => setEmpData({ ...empData, admissionDate: e.target.value })} /></div>
                                    <div className="grid grid-cols-1 gap-4">
                                        <div><label className="block text-xs font-semibold text-slate-500 uppercase">Setor</label><input type="text" className="w-full mt-1 p-2 border rounded-lg" value={empData.sector} onChange={e => setEmpData({ ...empData, sector: e.target.value })} /></div>
                                        {/* Shift removed */}
                                    </div>
                                    <div className="pt-4 flex justify-end"><button type="submit" className="bg-[#0F3F5C] text-white font-bold py-2 px-6 rounded-lg hover:bg-[#0A2A3D] transition">Salvar Alterações</button></div>
                                </div>
                            </div>
                        </form>
                    )}
                    {activeTab === 'responsibilities' && (
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                            <div className="flex gap-2 mb-6"><input className="flex-grow p-2 border rounded-lg" placeholder="Adicionar nova responsabilidade..." value={newResp} onChange={e => setNewResp(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddResponsibility()} /><button onClick={handleAddResponsibility} className="bg-green-600 text-white px-4 rounded-lg hover:bg-green-700">Adicionar</button></div>
                            <ul className="space-y-2">{responsibilities.map(r => (<li key={r.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100"><span className="text-slate-700">{r.description}</span><button onClick={() => handleDeleteResponsibility(r.id)} className="text-red-500 hover:text-red-700"><TrashIcon className="h-4 w-4" /></button></li>))} {responsibilities.length === 0 && <p className="text-slate-400 text-center py-4">Nenhuma atribuição cadastrada.</p>}</ul>
                        </div>
                    )}
                    {activeTab === 'development' && (
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                            <h3 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2 flex items-center gap-2">
                                <BookOpenIcon className="h-5 w-5 text-blue-500" />
                                Histórico Educacional e Cursos
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6 bg-slate-50 p-4 rounded-lg">
                                <div>
                                    <label className="text-xs font-bold text-slate-500">Tipo</label>
                                    <select
                                        className="w-full p-2 border rounded"
                                        value={newCourseData.educationType}
                                        onChange={e => setNewCourseData({ ...newCourseData, educationType: e.target.value as any })}
                                    >
                                        <option value="Escolaridade">Escolaridade Básica</option>
                                        <option value="Graduação">Graduação</option>
                                        <option value="Pós-Graduação">Pós-Graduação</option>
                                        <option value="Técnico">Curso Técnico</option>
                                        <option value="Curso Livre">Curso Livre / Treinamento</option>
                                        <option value="Certificação">Certificação</option>
                                    </select>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="text-xs font-bold text-slate-500">Nome do Curso / Formação</label>
                                    <input className="w-full p-2 border rounded" placeholder="Ex: Engenharia de Produção, NR-12..." value={newCourseData.courseName} onChange={e => setNewCourseData({ ...newCourseData, courseName: e.target.value })} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500">Instituição</label>
                                    <input className="w-full p-2 border rounded" placeholder="Ex: SENAI, USP..." value={newCourseData.institution} onChange={e => setNewCourseData({ ...newCourseData, institution: e.target.value })} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500">Data Conclusão</label>
                                    <input type="date" className="w-full p-2 border rounded" value={newCourseData.completionDate} onChange={e => setNewCourseData({ ...newCourseData, completionDate: e.target.value })} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500">Carga Horária (h)</label>
                                    <input type="number" className="w-full p-2 border rounded" placeholder="Ex: 40" value={newCourseData.workloadHours} onChange={e => setNewCourseData({ ...newCourseData, workloadHours: e.target.value })} />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="text-xs font-bold text-slate-500">Certificado (PDF/Img)</label>
                                    <input
                                        type="file"
                                        className="w-full text-xs text-slate-500 file:mr-2 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                        onChange={(e) => setCourseFile(e.target.files ? e.target.files[0] : null)}
                                    />
                                </div>
                                <div className="flex items-end">
                                    <button onClick={handleAddCourse} className="w-full bg-blue-600 text-white font-bold py-2 rounded hover:bg-blue-700 transition">Adicionar Qualificação</button>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs uppercase bg-slate-100 text-slate-600 font-bold">
                                        <tr>
                                            <th className="px-4 py-3">Tipo</th>
                                            <th className="px-4 py-3">Curso / Instituição</th>
                                            <th className="px-4 py-3">Conclusão</th>
                                            <th className="px-4 py-3 text-center">Certificado</th>
                                            <th className="px-4 py-3 text-center">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {courses.map(c => (
                                            <tr key={c.id} className="border-b hover:bg-slate-50">
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${c.educationType?.includes('Graduação') ? 'bg-purple-100 text-purple-700' :
                                                            c.educationType === 'Técnico' ? 'bg-orange-100 text-orange-700' :
                                                                'bg-slate-200 text-slate-700'
                                                        }`}>
                                                        {c.educationType || 'Curso'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="font-bold text-slate-800">{c.courseName}</div>
                                                    <div className="text-xs text-slate-500">{c.institution} {c.workloadHours ? `• ${c.workloadHours}h` : ''}</div>
                                                </td>
                                                <td className="px-4 py-3 text-slate-600">
                                                    {c.completionDate ? new Date(c.completionDate).toLocaleDateString() : '-'}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    {c.attachmentUrl ? (
                                                        <a href={c.attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline flex items-center justify-center gap-1 text-xs font-bold">
                                                            <DocumentTextIcon className="h-4 w-4" /> Ver Anexo
                                                        </a>
                                                    ) : <span className="text-slate-300">-</span>}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <button onClick={() => handleDeleteCourse(c.id)} className="text-red-400 hover:text-red-600"><TrashIcon className="h-4 w-4" /></button>
                                                </td>
                                            </tr>
                                        ))}
                                        {courses.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-slate-400">Nenhum curso registrado.</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                    {activeTab === 'evaluations' && (
                        <div className="space-y-6">
                            {!isEvaluating ? (<button onClick={() => setIsEvaluating(true)} className="w-full bg-[#0F3F5C] text-white font-bold py-3 rounded-xl hover:bg-[#0A2A3D] transition shadow-md">+ Nova Avaliação Rápida</button>) : (
                                <div className="bg-white p-6 rounded-xl border border-blue-100 shadow-md">
                                    <h4 className="font-bold text-lg mb-4 text-[#0F3F5C]">Nova Avaliação</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">{[{ key: 'organization', label: 'Organização' }, { key: 'cleanliness', label: 'Limpeza Máquina' }, { key: 'effort', label: 'Empenho' }, { key: 'communication', label: 'Comunicação' }, { key: 'improvement', label: 'Melhoria' }].map(cat => (<div key={cat.key} className="flex justify-between items-center bg-slate-50 p-3 rounded-lg"><span className="text-sm font-medium">{cat.label}</span>{/* @ts-ignore */}<StarRating score={evalScores[cat.key]} onChange={v => setEvalScores({ ...evalScores, [cat.key]: v })} /></div>))}</div>
                                    <textarea className="w-full border p-2 rounded-lg text-sm mb-4" placeholder="Observação..." value={evalNote} onChange={e => setEvalNote(e.target.value)} /><div className="flex justify-end gap-3"><button onClick={() => setIsEvaluating(false)} className="text-slate-500 hover:text-slate-700">Cancelar</button><button onClick={handleSubmitEvaluation} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold">Salvar Avaliação</button></div>
                                </div>
                            )}
                            <div className="space-y-4">{evaluations.map(ev => (<div key={ev.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm"><div className="flex justify-between items-start mb-2"><div><p className="text-sm font-bold text-slate-800">{new Date(ev.date).toLocaleDateString()} - Avaliado por {ev.evaluator}</p><div className="flex items-center mt-1"><StarIcon className="h-4 w-4 text-yellow-400 fill-current mr-1" /><span className="font-bold">{(ev.totalScore / 5).toFixed(1)}</span></div></div><span className="text-xs text-slate-400">Total: {ev.totalScore}/25</span></div>{ev.note && <p className="text-sm text-slate-600 bg-slate-50 p-2 rounded italic">"{ev.note}"</p>}</div>))}</div>
                        </div>
                    )}
                    {activeTab === 'hr' && (
                        <div className="space-y-6">
                            {/* Ausências / Faltas */}
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                                <h3 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2 flex items-center gap-2">
                                    <ExclamationIcon className="h-5 w-5 text-red-500" />
                                    Registro de Ausências e Faltas
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4 bg-slate-50 p-4 rounded-lg">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500">Tipo</label>
                                        <select className="w-full p-2 border rounded" value={newAbsence.type} onChange={e => setNewAbsence({ ...newAbsence, type: e.target.value })}>
                                            <option value="Falta Injustificada">Falta Injustificada</option>
                                            <option value="Atestado Médico">Atestado Médico</option>
                                            <option value="Licença">Licença</option>
                                            <option value="Suspensão">Suspensão</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500">Data Início</label>
                                        <input type="date" className="w-full p-2 border rounded" value={newAbsence.startDate} onChange={e => setNewAbsence({ ...newAbsence, startDate: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500">Data Fim (Opcional)</label>
                                        <input type="date" className="w-full p-2 border rounded" value={newAbsence.endDate} onChange={e => setNewAbsence({ ...newAbsence, endDate: e.target.value })} />
                                    </div>
                                    <div className="flex flex-col justify-end">
                                        <button onClick={handleAddAbsence} className="bg-red-600 text-white font-bold py-2 px-4 rounded hover:bg-red-700 transition">Registrar Ausência</button>
                                    </div>
                                    <div className="md:col-span-3">
                                        <label className="text-xs font-bold text-slate-500">Motivo / Observação</label>
                                        <input type="text" className="w-full p-2 border rounded" placeholder="Ex: Dor de barriga, Atestado Dr. Fulano..." value={newAbsence.reason} onChange={e => setNewAbsence({ ...newAbsence, reason: e.target.value })} />
                                    </div>
                                    <div className="md:col-span-1">
                                        <label className="text-xs font-bold text-slate-500">Anexo (Atestado/Foto)</label>
                                        <input
                                            type="file"
                                            className="w-full text-xs text-slate-500 file:mr-2 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                            onChange={(e) => setAbsenceFile(e.target.files ? e.target.files[0] : null)}
                                        />
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-100 text-slate-600 font-bold">
                                            <tr>
                                                <th className="p-3">Tipo</th>
                                                <th className="p-3">Período</th>
                                                <th className="p-3">Motivo</th>
                                                <th className="p-3 text-center">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {absences.map(abs => (
                                                <tr key={abs.id} className="border-b hover:bg-slate-50">
                                                    <td className="p-3 font-semibold text-slate-700">{abs.type}</td>
                                                    <td className="p-3 text-slate-600">
                                                        {new Date(abs.startDate).toLocaleDateString()}
                                                        {abs.endDate ? ` até ${new Date(abs.endDate).toLocaleDateString()}` : ''}
                                                    </td>
                                                    <td className="p-3 text-slate-500 italic">
                                                        {abs.reason || '-'}
                                                        {abs.attachmentUrl && (
                                                            <a href={abs.attachmentUrl} target="_blank" rel="noopener noreferrer" className="ml-2 inline-flex items-center gap-1 text-blue-500 hover:underline text-xs">
                                                                <DownloadIcon className="h-3 w-3" /> Ver Anexo
                                                            </a>
                                                        )}
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <button onClick={() => handleDeleteAbsence(abs.id)} className="text-red-400 hover:text-red-600"><TrashIcon className="h-4 w-4" /></button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {absences.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-slate-400">Nenhum registro encontrado.</td></tr>}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Férias */}
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                                <h3 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2 flex items-center gap-2">
                                    <ClockIcon className="h-5 w-5 text-blue-500" />
                                    Controle de Férias
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4 bg-blue-50 p-4 rounded-lg">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500">Período Aquisitivo</label>
                                        <input type="text" placeholder="Ex: 2024-2025" className="w-full p-2 border rounded" value={newVacation.period} onChange={e => setNewVacation({ ...newVacation, period: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500">Início do Gozo</label>
                                        <input type="date" className="w-full p-2 border rounded" value={newVacation.startDate} onChange={e => setNewVacation({ ...newVacation, startDate: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500">Fim do Gozo</label>
                                        <input type="date" className="w-full p-2 border rounded" value={newVacation.endDate} onChange={e => setNewVacation({ ...newVacation, endDate: e.target.value })} />
                                    </div>
                                    <div className="flex flex-col justify-end">
                                        <button onClick={handleAddVacation} className="bg-blue-600 text-white font-bold py-2 px-4 rounded hover:bg-blue-700 transition">Agendar Férias</button>
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-100 text-slate-600 font-bold">
                                            <tr>
                                                <th className="p-3">Período Aquisitivo</th>
                                                <th className="p-3">Data de Gozo</th>
                                                <th className="p-3">Status</th>
                                                <th className="p-3 text-center">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {vacations.map(vac => (
                                                <tr key={vac.id} className="border-b hover:bg-slate-50">
                                                    <td className="p-3 font-semibold text-slate-700">{vac.period}</td>
                                                    <td className="p-3 text-slate-600">
                                                        {new Date(vac.startDate).toLocaleDateString()} a {new Date(vac.endDate).toLocaleDateString()}
                                                    </td>
                                                    <td className="p-3">
                                                        <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">{vac.status}</span>
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <button onClick={() => handleDeleteVacation(vac.id)} className="text-red-400 hover:text-red-600"><TrashIcon className="h-4 w-4" /></button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {vacations.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-slate-400">Nenhuma férias registrada.</td></tr>}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- ORG CHART COMPONENTS ---

interface OrgTreeItem extends OrgUnit {
    children: OrgTreeItem[];
    positions: OrgPosition[];
}

const OrgNode: React.FC<{
    node: OrgTreeItem;
    employees: Employee[];
    onAddSubUnit: (parentId: string) => void;
    onAddPosition: (unitId: string) => void;
    onDeleteUnit: (id: string) => void;
    onDeletePosition: (id: string) => void;
    onAssignEmployee: (posId: string, empId: string) => void;
    onCreateEmployee: (posId: string) => void; // Shortcut to create emp for this position
    onEditEmployee: (employee: Employee) => void; // New prop
    onEditUnit: (id: string, currentName: string) => void;
    evaluations: Evaluation[];
}> = ({ node, employees, onAddSubUnit, onAddPosition, onDeleteUnit, onDeletePosition, onAssignEmployee, onCreateEmployee, onEditEmployee, onEditUnit, evaluations }) => {

    // Color mapping based on type
    const getNodeColor = (type?: string) => {
        switch (type) {
            case 'department': return 'bg-amber-400 border-amber-500 text-white'; // Amarelo (Administrativo, Produção)
            case 'group': return 'bg-green-600 border-green-700 text-white'; // Verde (Máquinas)
            case 'machine': return 'bg-orange-500 border-orange-600 text-white'; // Laranja (Máquinas Trefila/Treliça)
            default: return 'bg-slate-500 border-slate-600 text-white';
        }
    };

    return (
        <div className="flex flex-col items-center">
            {/* The Node Itself */}
            <div className={`relative p-3 rounded-lg shadow-md border-b-4 mb-4 min-w-[200px] text-center group transition-transform hover:-translate-y-1 ${getNodeColor(node.unitType)}`}>
                <div className="font-bold text-lg uppercase tracking-wide">{node.name}</div>
                {/* Controls */}
                <div className="absolute -top-3 -right-3 hidden group-hover:flex gap-1">
                    <button onClick={() => onEditUnit(node.id, node.name)} className="p-1 bg-white rounded-full text-slate-600 shadow-sm hover:scale-110" title="Editar Nome">
                        <PencilIcon className="h-4 w-4" />
                    </button>
                    <button onClick={() => onAddSubUnit(node.id)} className="p-1 bg-white rounded-full text-blue-600 shadow-sm hover:scale-110" title="Adicionar Sub-Área">
                        <PlusIcon className="h-4 w-4" />
                    </button>
                    <button onClick={() => onAddPosition(node.id)} className="p-1 bg-white rounded-full text-amber-600 shadow-sm hover:scale-110" title="Adicionar Cargo/Função">
                        <UserIcon className="h-4 w-4" />
                    </button>
                    <button onClick={() => onDeleteUnit(node.id)} className="p-1 bg-white rounded-full text-red-600 shadow-sm hover:scale-110" title="Remover Área">
                        <TrashIcon className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Positions directly under this Node (Vertical list usually) */}
            {node.positions.length > 0 && (
                <div className="flex flex-col items-center gap-2 mb-6 px-2 w-full">
                    {node.positions.map(pos => {
                        const occupant = employees.find(e => e.orgPositionId === pos.id);
                        // Calculate Rating
                        const empEvals = occupant ? evaluations.filter(ev => ev.employeeId === occupant.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) : [];
                        const lastScore = empEvals.length > 0 ? (empEvals[0].totalScore / 5) : 0;

                        return (
                            <div key={pos.id} className="flex flex-col items-center relative group/pos w-full max-w-[200px]">
                                {/* Blue Box: Role */}
                                <div className="bg-[#4a86e8] text-white px-2 py-1 rounded-t-lg shadow-sm font-semibold text-xs w-full text-center border-b border-blue-400 relative truncate" title={pos.title}>
                                    {pos.title}
                                    <button onClick={() => onDeletePosition(pos.id)} className="absolute top-0.5 right-1 opacity-0 group-hover/pos:opacity-100 text-white hover:text-red-200">
                                        <XIcon className="h-3 w-3" />
                                    </button>
                                </div>

                                {/* Employee Box Content */}
                                <div className="bg-white border-x border-b border-slate-300 rounded-b-lg p-2 w-full shadow-sm min-h-[50px] flex items-center justify-center relative hover:bg-slate-50 transition-colors">
                                    {occupant ? (
                                        <div className="flex items-center w-full gap-2 cursor-pointer" onClick={() => onEditEmployee(occupant)}>
                                            {/* Avatar */}
                                            <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden border border-slate-300 shrink-0">
                                                {occupant.photoUrl ? (
                                                    <img src={occupant.photoUrl} alt={occupant.name} className="h-full w-full object-cover" />
                                                ) : (
                                                    <span className="text-xs font-bold text-slate-500">{occupant.name.charAt(0)}</span>
                                                )}
                                            </div>
                                            {/* Info */}
                                            <div className="flex flex-col min-w-0 flex-grow">
                                                <p className="font-bold text-xs text-slate-800 truncate leading-tight mb-0.5">{occupant.name}</p>
                                                <div className="flex items-center">
                                                    <StarIcon className={`h-3 w-3 ${lastScore > 0 ? 'text-yellow-400 fill-current' : 'text-slate-200'}`} />
                                                    <span className="text-[10px] text-slate-500 ml-1 font-semibold">{lastScore > 0 ? lastScore.toFixed(1) : '-'}</span>
                                                </div>
                                            </div>
                                            {/* Hidden Edit Trigger for quick swap (optional, or just click to edit) */}
                                        </div>
                                    ) : (
                                        // Empty State - Dropdown to assign
                                        <select
                                            className="w-full bg-transparent outline-none text-slate-400 font-medium text-center cursor-pointer text-[10px] py-1"
                                            value=""
                                            onChange={(e) => {
                                                if (e.target.value === 'NEW') onCreateEmployee(pos.id);
                                                else if (e.target.value) onAssignEmployee(pos.id, e.target.value);
                                            }}
                                        >
                                            <option value="">(Vago)</option>
                                            {employees.filter(e => !e.orgPositionId).map(emp => (
                                                <option key={emp.id} value={emp.id}>{emp.name}</option>
                                            ))}
                                            <option value="NEW" className="font-bold text-blue-600">+ Contratar</option>
                                        </select>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Add Position Button for this Node */}
            <div className="mb-6 opacity-0 hover:opacity-100 transition-opacity -mt-4">
                <button onClick={() => onAddPosition(node.id)} className="text-xs bg-slate-200 hover:bg-slate-300 text-slate-600 px-2 py-1 rounded-full flex items-center gap-1">
                    <PlusIcon className="h-3 w-3" /> Cargo
                </button>
            </div>

            {/* Children Nodes (Horizontal Layout) */}
            {/* Line from Parent down to Children */}
            {node.children.length > 0 && (
                <div className="h-6 w-0.5 bg-slate-300"></div>
            )}

            {/* Children Nodes (Horizontal Layout) */}
            {node.children.length > 0 && (
                <div className="relative flex justify-center">
                    {node.children.map((child, index) => {
                        const isFirst = index === 0;
                        const isLast = index === node.children.length - 1;

                        return (
                            <div key={child.id} className="relative flex flex-col items-center px-3 pt-6">
                                {/* Connector Lines */}
                                {/* Vertical Line Up */}
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 h-6 w-0.5 bg-slate-300"></div>

                                {/* Horizontal Line Left (to connect to previous sibling) */}
                                {!isFirst && <div className="absolute top-0 left-0 w-[50%] h-0.5 bg-slate-300"></div>}

                                {/* Horizontal Line Right (to connect to next sibling) */}
                                {!isLast && <div className="absolute top-0 right-0 w-[50%] h-0.5 bg-slate-300"></div>}

                                <OrgNode
                                    node={child}
                                    employees={employees}
                                    onAddSubUnit={onAddSubUnit}
                                    onAddPosition={onAddPosition}
                                    onDeleteUnit={onDeleteUnit}
                                    onDeletePosition={onDeletePosition}
                                    onAssignEmployee={onAssignEmployee}
                                    onCreateEmployee={onCreateEmployee}
                                    onEditEmployee={onEditEmployee}
                                    onEditUnit={onEditUnit}
                                    evaluations={evaluations}
                                />
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

const OrgChart: React.FC<{
    employees: Employee[];
    reloadData: () => void;
    triggerAddEmployee: (posId?: string, prefillSector?: string) => void;
    triggerEditEmployee: (emp: Employee) => void;
    evaluations: Evaluation[];
}> = ({ employees, reloadData, triggerAddEmployee, triggerEditEmployee, evaluations }) => {
    const [units, setUnits] = useState<OrgUnit[]>([]);
    const [positions, setPositions] = useState<OrgPosition[]>([]);
    const [tree, setTree] = useState<OrgTreeItem[]>([]);

    useEffect(() => { loadOrgData(); }, [employees]);

    const loadOrgData = async () => {
        const u = await fetchTable<OrgUnit>('org_units');
        const p = await fetchTable<OrgPosition>('org_positions');
        setUnits(u);
        setPositions(p);
        setTree(buildTree(u, p));
    };

    const buildTree = (allUnits: OrgUnit[], allPositions: OrgPosition[]): OrgTreeItem[] => {
        const unitMap = new Map<string, OrgTreeItem>();
        allUnits.forEach(u => unitMap.set(u.id, { ...u, children: [], positions: [] }));

        const roots: OrgTreeItem[] = [];

        // Assign positions to units
        allPositions.forEach(p => {
            const unit = unitMap.get(p.orgUnitId);
            if (unit) unit.positions.push(p);
        });

        // Build hierarchy
        allUnits.forEach(u => {
            const item = unitMap.get(u.id)!;
            if (u.parentId && unitMap.has(u.parentId)) {
                unitMap.get(u.parentId)!.children.push(item);
            } else {
                roots.push(item);
            }
        });

        return roots.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    };

    // --- Actions ---

    const handleEditUnit = async (id: string, currentName: string) => {
        const newName = prompt("Novo nome da área:", currentName);
        if (newName && newName !== currentName) {
            await updateItem('org_units', id, { name: newName });
            loadOrgData();
        }
    };

    const handleCreateRoot = async () => {
        const name = prompt("Nome do Departamento/Área Principal:");
        if (!name) return;

        // Simple heuristic: if name contains 'Maquina' -> machine, else department
        const type = name.toLowerCase().includes('maquina') ? 'machine' : (name.toLowerCase().includes('maquinas') ? 'group' : 'department');

        await insertItem('org_units', { name, unitType: type, displayOrder: units.length + 1 });
        loadOrgData();
    };

    const handleAddSubUnit = async (parentId: string) => {
        const name = prompt("Nome da Sub-Área / Máquina:");
        if (!name) return;
        const parent = units.find(u => u.id === parentId);

        let type = 'department';
        if (parent?.unitType === 'department') type = 'group'; // Dept -> Group (e.g. Produção -> Máquinas)
        if (parent?.unitType === 'group') type = 'machine'; // Group -> Machine (e.g. Máquinas -> Trefila 01)
        if (name.toLowerCase().includes('maquina')) type = 'machine';

        await insertItem('org_units', { name, unitType: type, parentId, displayOrder: 99 });
        loadOrgData();
    };

    const handleAddPosition = async (unitId: string) => {
        const title = prompt("Nome do Cargo/Função:");
        if (!title) return;
        await insertItem('org_positions', { orgUnitId: unitId, title, isLeadership: false });
        loadOrgData();
    };

    const handleDeleteUnit = async (id: string) => {
        if (!confirm('Excluir esta área e todos os itens dentro dela?')) return;
        await deleteItem('org_units', id);
        loadOrgData();
    };

    const handleDeletePosition = async (id: string) => {
        if (!confirm('Excluir cargo?')) return;
        await deleteItem('org_positions', id);
        loadOrgData();
    };

    const handleAssignEmployee = async (positionId: string, employeeId: string) => {
        // 1. Find details to sync
        const targetPos = positions.find(p => p.id === positionId);
        const targetUnit = units.find(u => u.id === targetPos?.orgUnitId);

        // 2. Clear previous position of this employee if any (logic remains similar)
        // If we are moving an employee, we just update them. 
        // If we are unassigning (employeeId is empty), we find who WAS there.

        if (employeeId) {
            // Sync Job Title and Sector automatically
            const updates: Partial<Employee> = {
                orgPositionId: positionId,
                jobTitle: targetPos?.title || undefined,
                sector: targetUnit?.name || undefined
            };
            await updateItem('employees', employeeId, updates);
        } else {
            // Unassign logic: Find who is currently in this position
            const occupants = employees.filter(e => e.orgPositionId === positionId);
            for (const occ of occupants) {
                await updateItem('employees', occ.id, { orgPositionId: null });
            }
        }
        reloadData();
    };

    const handleCreateEmployeeForPosition = (positionId: string) => {
        // Find unit name for prefill
        const pos = positions.find(p => p.id === positionId);
        const unit = units.find(u => u.id === pos?.orgUnitId);
        triggerAddEmployee(positionId, unit?.name);
    };

    return (
        <div className="overflow-auto p-8 min-h-[600px] bg-slate-50 relative">
            <div className="flex gap-8 min-w-max justify-center items-start pt-10">
                {/* Render Existing Roots */}
                {tree.map(root => (
                    <OrgNode
                        key={root.id}
                        node={root}
                        employees={employees}
                        onAddSubUnit={handleAddSubUnit}
                        onAddPosition={handleAddPosition}
                        onDeleteUnit={handleDeleteUnit}
                        onDeletePosition={handleDeletePosition}
                        onAssignEmployee={handleAssignEmployee}
                        onCreateEmployee={handleCreateEmployeeForPosition}
                        onEditEmployee={triggerEditEmployee}
                        onEditUnit={handleEditUnit}
                        evaluations={evaluations}
                    />
                ))}

                {/* Add New Root Button (Inline) */}
                <div className="flex flex-col items-center opacity-60 hover:opacity-100 transition-opacity">
                    <button
                        onClick={handleCreateRoot}
                        className="w-[200px] h-[100px] border-4 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 hover:border-slate-400 transition"
                    >
                        <PlusIcon className="h-8 w-8 mb-2" />
                        <span className="font-bold">Nova Área Principal</span>
                    </button>
                    <p className="text-xs text-slate-400 mt-2 text-center max-w-[180px]">
                        Ex: Administrativo, Comercial, Logística...
                    </p>
                </div>
            </div>
        </div>
    );
};


const PeopleManagement: React.FC<PeopleManagementProps> = ({ setPage, currentUser }) => {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
    const [absences, setAbsences] = useState<EmployeeAbsence[]>([]);
    const [vacations, setVacations] = useState<EmployeeVacation[]>([]);
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
    const [viewMode, setViewMode] = useState<'dashboard' | 'cards' | 'orgChart'>('dashboard');

    // Employee Form State (Simplified for direct creation)
    const [newEmployeeName, setNewEmployeeName] = useState('');

    const loadData = async () => {
        const emp = await fetchTable<Employee>('employees');
        const evals = await fetchTable<Evaluation>('evaluations');
        const abs = await fetchTable<EmployeeAbsence>('employee_absences');
        const vacs = await fetchTable<EmployeeVacation>('employee_vacations');
        setEmployees(emp);
        setEvaluations(evals);
        setAbsences(abs);
        setVacations(vacs);
    };

    useEffect(() => { loadData(); }, []);

    // New Flow: Create Placeholder -> Open Detail Modal
    const handleCreateAndEdit = async (name: string, positionId?: string, sector?: string) => {
        if (!name) return;
        try {
            // Auto-fill Job Title from Position Name if linked via OrgChart
            let autoJobTitle = '';
            if (positionId) {
                try {
                    const connectedPosList = await fetchByColumn<OrgPosition>('org_positions', 'id', positionId);
                    if (connectedPosList && connectedPosList.length > 0) {
                        autoJobTitle = connectedPosList[0].title;
                    }
                } catch (e) { console.error('Error fetching position for auto-fill', e); }
            }

            const newEmpPayload: Partial<Employee> = {
                name: name,
                sector: sector || 'Não Definido',
                shift: '-', // Placeholder to satisfy DB NOT NULL constraint
                active: true,
                orgPositionId: positionId || undefined,
                jobTitle: autoJobTitle, // Auto-sync Job Title
                phone: '',
                // Dates MUST be omitted or null, not empty strings
                // admissionDate: undefined,
                // birthDate: undefined
            };

            const newEmp = await insertItem<Employee>('employees', newEmpPayload as Employee);

            await loadData();
            setSelectedEmployee(newEmp);

        } catch (error) {
            console.error(error);
            alert('Erro ao criar registro inicial. Verifique o console.');
        }
    };

    const promptAndCreateEmployee = (posId?: string, sector?: string) => {
        const name = prompt("Nome do Novo Funcionário:");
        if (name) {
            handleCreateAndEdit(name, posId, sector);
        }
    };

    // ... delete function remains ...
    const handleDeleteEmployee = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir este funcionário? Essa ação não pode ser desfeita.')) return;
        try {
            await deleteItem('employees', id);
            alert('Funcionário excluído.');
            setSelectedEmployee(null);
            loadData();
        } catch (error) {
            alert('Erro ao excluir.');
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-4 sm:p-6 md:p-8">
            {selectedEmployee && (
                <EmployeeDetailModal
                    employee={selectedEmployee}
                    currentUser={currentUser}
                    onClose={() => setSelectedEmployee(null)}
                    onSave={loadData}
                    onDelete={() => handleDeleteEmployee(selectedEmployee.id)}
                />
            )}

            {/* Simple Add Modal removed, replaced by direct prompt logic */}

            <header className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                <div className="flex items-center">
                    <button onClick={() => setPage('menu')} className="mr-4 p-2 rounded-full hover:bg-slate-200 transition">
                        <ArrowLeftIcon className="h-6 w-6 text-slate-700" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">Gestão de Pessoas</h1>
                        <p className="text-slate-500">Prontuário Digital e Organograma</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                    <button
                        onClick={() => setViewMode('dashboard')}
                        className={`px-4 py-2 rounded-md font-medium text-sm transition ${viewMode === 'dashboard' ? 'bg-slate-100 text-[#0F3F5C] font-bold' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Dashboard
                    </button>
                    <button
                        onClick={() => setViewMode('cards')}
                        className={`px-4 py-2 rounded-md font-medium text-sm transition ${viewMode === 'cards' ? 'bg-slate-100 text-[#0F3F5C] font-bold' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Cards / Lista
                    </button>
                    <button
                        onClick={() => setViewMode('orgChart')}
                        className={`px-4 py-2 rounded-md font-medium text-sm transition ${viewMode === 'orgChart' ? 'bg-slate-100 text-[#0F3F5C] font-bold' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Organograma Visual
                    </button>
                </div>

                <button onClick={() => promptAndCreateEmployee()} className="bg-[#0F3F5C] text-white px-4 py-2 rounded-lg font-bold hover:bg-[#0A2A3D] transition flex items-center gap-2">
                    <PlusIcon className="h-5 w-5" />
                    Novo Funcionário
                </button>
            </header>

            {viewMode === 'cards' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {employees.map(emp => (
                        <EmployeeCard
                            key={emp.id}
                            employee={emp}
                            evaluations={evaluations}
                            onSelect={() => setSelectedEmployee(emp)}
                            onDelete={() => handleDeleteEmployee(emp.id)}
                        />
                    ))}
                    {employees.length === 0 && (
                        <div className="col-span-full text-center py-10 text-slate-500">
                            Nenhum funcionário cadastrado. Adicione o primeiro!
                        </div>
                    )}
                </div>
            ) : viewMode === 'orgChart' ? (
                <OrgChart
                    employees={employees}
                    evaluations={evaluations}
                    reloadData={loadData}
                    triggerAddEmployee={promptAndCreateEmployee}
                    triggerEditEmployee={(emp) => setSelectedEmployee(emp)}
                />
            ) : (
                <DashboardRH employees={employees} absences={absences} vacations={vacations} />
            )}
        </div>
    );
};

export default PeopleManagement;
