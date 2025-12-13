import React, { useState, useEffect } from 'react';
import { ArrowLeftIcon, PlusIcon, StarIcon, ChartBarIcon, TrophyIcon, SearchIcon, FilterIcon, UserIcon, BookOpenIcon, ClockIcon, DocumentTextIcon, PencilIcon, TrashIcon, UserGroupIcon, ExclamationIcon, SaveIcon, XIcon } from './icons';
import type { Page, Employee, Evaluation, Achievement, User, EmployeeCourse, EmployeeAbsence, EmployeeVacation, EmployeeResponsibility, OrgUnit, OrgPosition } from '../types';
import { fetchTable, insertItem, updateItem, deleteItem, fetchByColumn } from '../services/supabaseService';

interface PeopleManagementProps {
    setPage: (page: Page) => void;
    currentUser: User | null;
}

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
const EmployeeCard: React.FC<{ employee: Employee; onSelect: () => void; evaluations: Evaluation[] }> = ({ employee, onSelect, evaluations }) => {
    const employeeEvals = evaluations.filter(e => e.employeeId === employee.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const lastEvaluation = employeeEvals[0];
    const displayScore = lastEvaluation ? (lastEvaluation.totalScore / 5) : 0;

    return (
        <div onClick={onSelect} className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer border border-slate-100 p-4 flex items-center space-x-4">
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
            <div className="text-blue-500">
                <ChartBarIcon className="h-6 w-6" />
            </div>
        </div>
    );
};


// ... EmployeeDetailModal (Same as before) ...
const EmployeeDetailModal: React.FC<{
    employee: Employee;
    onClose: () => void;
    onSave: () => void;
    currentUser: User | null;
}> = ({ employee, onClose, onSave, currentUser }) => {
    // ... Copy existing implementation or use a placeholder if too long (I'll keep it shortened for this specific file write as the focus is Organograma)
    // To ensure I don't break existing features, I will replicate it or assume it's there. 
    // Given the previous step saw the full file, I will perform a full overwrite including the Modal code to be safe.

    const [activeTab, setActiveTab] = useState<'profile' | 'responsibilities' | 'development' | 'hr' | 'evaluations'>('profile');
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
                        <div className="h-20 w-20 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden border-4 border-white shadow-sm">
                            {empData.photoUrl ? <img src={empData.photoUrl} alt={empData.name} className="h-full w-full object-cover" /> : <span className="text-3xl font-bold text-slate-400">{empData.name.charAt(0)}</span>}
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-slate-800">{empData.name}</h2>
                            <p className="text-slate-500">{empData.sector} • {empData.shift}</p>
                            <div className="flex space-x-2 mt-2">
                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${empData.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{empData.active ? 'Ativo' : 'Inativo'}</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-200 transition">✕</button>
                </div>
                <div className="flex border-b border-slate-200 bg-white">
                    {[
                        { id: 'profile', label: 'Resumo / Perfil', icon: <UserIcon className="h-4 w-4" /> },
                        { id: 'responsibilities', label: 'Atribuições', icon: <DocumentTextIcon className="h-4 w-4" /> },
                        { id: 'development', label: 'Desenvolvimento', icon: <BookOpenIcon className="h-4 w-4" /> },
                        { id: 'hr', label: 'RH (Férias/Faltas)', icon: <ClockIcon className="h-4 w-4" /> },
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
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="block text-xs font-semibold text-slate-500 uppercase">Setor</label><input type="text" className="w-full mt-1 p-2 border rounded-lg" value={empData.sector} onChange={e => setEmpData({ ...empData, sector: e.target.value })} /></div>
                                        <div><label className="block text-xs font-semibold text-slate-500 uppercase">Turno</label><select className="w-full mt-1 p-2 border rounded-lg" value={empData.shift} onChange={e => setEmpData({ ...empData, shift: e.target.value })}><option>Manhã</option><option>Tarde</option><option>Noite</option></select></div>
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
                            <div className="flex gap-2 mb-6"><input className="flex-grow p-2 border rounded-lg" placeholder="Adicionar curso/treinamento..." value={newCourse} onChange={e => setNewCourse(e.target.value)} /><button onClick={handleAddCourse} className="bg-blue-600 text-white px-4 rounded-lg hover:bg-blue-700">Adicionar</button></div>
                            <table className="w-full text-sm text-left"><thead className="text-xs uppercase bg-slate-50 text-slate-500"><tr><th className="px-4 py-2">Curso</th><th className="px-4 py-2">Instituição</th><th className="px-4 py-2">Status</th></tr></thead><tbody>{courses.map(c => (<tr key={c.id} className="border-b"><td className="px-4 py-3 font-medium">{c.courseName}</td><td className="px-4 py-3 text-slate-500">{c.institution || '-'}</td><td className="px-4 py-3"><span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs">{c.status}</span></td></tr>))}</tbody></table>
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
                    {activeTab === 'hr' && <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 text-center"><ClockIcon className="h-12 w-12 text-slate-300 mx-auto mb-4" /><h3 className="text-lg font-medium text-slate-700">Histórico de Férias e Ausências</h3><p className="text-slate-500 mb-6">Em breve você poderá gerenciar programações de férias e atestados aqui.</p><button className="bg-slate-200 text-slate-600 px-4 py-2 rounded-lg" disabled>Funcionalidade em desenvolvimento</button></div>}
                </div>
            </div>
        </div>
    );
};

// --- ORG CHART COMPONENTS ---

const OrgChart: React.FC<{ employees: Employee[]; reloadData: () => void }> = ({ employees, reloadData }) => {
    const [units, setUnits] = useState<OrgUnit[]>([]);
    const [positions, setPositions] = useState<OrgPosition[]>([]);
    const [isEditing, setIsEditing] = useState(false);

    // Add Unit
    const [newUnitName, setNewUnitName] = useState('');

    useEffect(() => {
        loadOrgData();
    }, [employees]);

    const loadOrgData = async () => {
        const u = await fetchTable<OrgUnit>('org_units');
        const p = await fetchTable<OrgPosition>('org_positions');
        // Sort by display order if available, or name
        setUnits(u.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0)));
        setPositions(p);
    };

    const handleAddUnit = async () => {
        if (!newUnitName) return;
        await insertItem('org_units', { name: newUnitName, unitType: 'machine', displayOrder: units.length + 1 });
        setNewUnitName('');
        loadOrgData();
    };

    const handleDeleteUnit = async (id: string) => {
        if (!confirm('Ao deletar a unidade, todos os cargos vinculados serão removidos. Continuar?')) return;
        await deleteItem('org_units', id);
        loadOrgData();
    };

    // Position Handlers
    const handleAddPosition = async (unitId: string, title: string) => {
        await insertItem('org_positions', { orgUnitId: unitId, title, isLeadership: false, displayOrder: 0 });
        loadOrgData();
    };

    const handleDeletePosition = async (id: string) => {
        if (!confirm('Remover este cargo?')) return;
        await deleteItem('org_positions', id);
        loadOrgData();
    };

    const handleAssignEmployee = async (positionId: string, employeeId: string) => {
        // Find employee and update
        // If employeeId is empty, it means unassign. But we need the employee who is currently there?
        // Actually, we iterate employees to find who has this positionId.
        const currentOccupant = employees.find(e => e.orgPositionId === positionId);
        if (currentOccupant) {
            await updateItem('employees', currentOccupant.id, { orgPositionId: null });
        }

        if (employeeId) {
            // Check if new employee is elsewhere? Maybe warning? For now just move them.
            await updateItem('employees', employeeId, { orgPositionId: positionId });
        }
        reloadData(); // Reload employees in parent
    };

    return (
        <div className="overflow-x-auto pb-8">
            <div className="flex items-start gap-8 min-w-max p-4">
                {/* Unit Columns */}
                {units.map(unit => (
                    <div key={unit.id} className="w-80 flex-shrink-0 flex flex-col gap-2">
                        {/* Orange Box: Unit Header */}
                        <div className="bg-orange-500 text-white p-3 rounded-lg shadow-md font-bold text-center relative group">
                            {unit.name}
                            <button onClick={() => handleDeleteUnit(unit.id)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 hover:text-red-200 transition">
                                <TrashIcon className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Blue Boxes: Positions */}
                        <div className="flex flex-col gap-4 mt-2 border-l-2 border-dashed border-slate-300 pl-4 ml-4">
                            {positions.filter(p => p.orgUnitId === unit.id).map(pos => {
                                const occupant = employees.find(e => e.orgPositionId === pos.id);
                                return (
                                    <div key={pos.id} className="flex flex-col items-center">
                                        {/* Blue Box: Job Title */}
                                        <div className="bg-blue-500 text-white px-4 py-2 rounded shadow-sm text-sm font-semibold mb-1 w-full text-center relative group">
                                            {pos.title}
                                            <button onClick={() => handleDeletePosition(pos.id)} className="absolute top-1 right-2 opacity-0 group-hover:opacity-100 hover:text-red-200 transition">
                                                <XIcon className="h-3 w-3" />
                                            </button>
                                        </div>

                                        {/* White Box: Employee */}
                                        <div className="bg-white border border-slate-300 rounded px-3 py-1 text-sm text-slate-700 shadow-sm w-3/4 text-center">
                                            <select
                                                className="w-full bg-transparent outline-none text-center cursor-pointer"
                                                value={occupant ? occupant.id : ''}
                                                onChange={(e) => handleAssignEmployee(pos.id, e.target.value)}
                                            >
                                                <option value="">-- Vago --</option>
                                                {employees.map(emp => (
                                                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Add Position Button */}
                            <div className="mt-2">
                                <input
                                    placeholder="+ Cargo"
                                    className="w-full text-sm p-1 border rounded bg-slate-50"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleAddPosition(unit.id, e.currentTarget.value);
                                            e.currentTarget.value = '';
                                        }
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                ))}

                {/* Add Unit Column */}
                <div className="w-80 flex-shrink-0 opacity-50 hover:opacity-100 transition">
                    <div className="border-2 border-dashed border-slate-400 rounded-lg p-4 flex flex-col items-center justify-center h-32 cursor-pointer bg-slate-100">
                        <input
                            placeholder="Nova Máquina/Área..."
                            className="bg-transparent border-b border-slate-400 focus:outline-none text-center mb-2"
                            value={newUnitName}
                            onChange={e => setNewUnitName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAddUnit()}
                        />
                        <button onClick={handleAddUnit} className="bg-slate-300 px-3 py-1 rounded text-sm hover:bg-slate-400">Criar</button>
                    </div>
                </div>
            </div>
        </div>
    );
};


const PeopleManagement: React.FC<PeopleManagementProps> = ({ setPage, currentUser }) => {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [viewMode, setViewMode] = useState<'cards' | 'orgChart'>('cards');

    // Employee Form State
    const [newEmployeeName, setNewEmployeeName] = useState('');
    const [newEmployeeSector, setNewEmployeeSector] = useState('');
    const [newEmployeeShift, setNewEmployeeShift] = useState('');

    const loadData = async () => {
        const emp = await fetchTable<Employee>('employees');
        const evals = await fetchTable<Evaluation>('evaluations');
        setEmployees(emp);
        setEvaluations(evals);
    };

    useEffect(() => { loadData(); }, []);

    const handleAddEmployee = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await insertItem<Employee>('employees', {
                // @ts-ignore
                name: newEmployeeName, sector: newEmployeeSector, shift: newEmployeeShift, active: true
            } as Employee);
            alert('Funcionário cadastrado!');
            setIsAddModalOpen(false);
            setNewEmployeeName(''); setNewEmployeeSector(''); setNewEmployeeShift('');
            loadData();
        } catch (error) { alert('Erro ao cadastrar.'); }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-4 sm:p-6 md:p-8">
            {selectedEmployee && (
                <EmployeeDetailModal
                    employee={selectedEmployee}
                    currentUser={currentUser}
                    onClose={() => setSelectedEmployee(null)}
                    onSave={loadData}
                />
            )}

            {isAddModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <form onSubmit={handleAddEmployee} className="bg-white p-6 rounded-xl shadow-xl w-full max-w-md">
                        <h2 className="text-xl font-bold mb-4">Novo Funcionário</h2>
                        <input className="w-full p-2 border rounded mb-3" placeholder="Nome" value={newEmployeeName} onChange={e => setNewEmployeeName(e.target.value)} required />
                        <input className="w-full p-2 border rounded mb-3" placeholder="Setor/Máquina" value={newEmployeeSector} onChange={e => setNewEmployeeSector(e.target.value)} required />
                        <select className="w-full p-2 border rounded mb-4" value={newEmployeeShift} onChange={e => setNewEmployeeShift(e.target.value)} required>
                            <option value="">Selecione Turno</option>
                            <option value="Manhã">Manhã</option>
                            <option value="Tarde">Tarde</option>
                            <option value="Noite">Noite</option>
                        </select>
                        <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 bg-slate-200 rounded">Cancelar</button>
                            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Salvar</button>
                        </div>
                    </form>
                </div>
            )}

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

                <button onClick={() => setIsAddModalOpen(true)} className="bg-[#0F3F5C] text-white px-4 py-2 rounded-lg font-bold hover:bg-[#0A2A3D] transition flex items-center gap-2">
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
                        />
                    ))}
                    {employees.length === 0 && (
                        <div className="col-span-full text-center py-10 text-slate-500">
                            Nenhum funcionário cadastrado. Adicione o primeiro!
                        </div>
                    )}
                </div>
            ) : (
                <OrgChart employees={employees} reloadData={loadData} />
            )}
        </div>
    );
};

export default PeopleManagement;
