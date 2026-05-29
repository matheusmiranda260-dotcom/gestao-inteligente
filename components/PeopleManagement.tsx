import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ArrowLeftIcon, PlusIcon, StarIcon, ChartBarIcon, TrophyIcon, SearchIcon, FilterIcon, UserIcon, BookOpenIcon, ClockIcon, DocumentTextIcon, PencilIcon, TrashIcon, UserGroupIcon, ExclamationIcon, SaveIcon, XIcon, DownloadIcon, PrinterIcon, CheckCircleIcon } from './icons';
import type { Page, Employee, Evaluation, Achievement, User, EmployeeCourse, EmployeeAbsence, EmployeeVacation, EmployeeResponsibility, OrgUnit, OrgPosition, EmployeeDocument, KaizenProblem } from '../types';
import { fetchTable, insertItem, updateItem, deleteItem, deleteItemByColumn, fetchByColumn, uploadFile } from '../services/supabaseService';

interface PeopleManagementProps {
    setPage: (page: Page) => void;
    currentUser: User | null;
}

// Helper for resizing images (Mobile Optimization)
const resizeImage = (file: File, maxWidth = 1200, quality = 0.7): Promise<File> => {
    return new Promise((resolve, reject) => {
        if (!file.type.match(/image.*/)) {
            resolve(file); // Not an image, return original
            return;
        }
        const reader = new FileReader();
        reader.onload = (readerEvent: any) => {
            const image = new Image();
            image.onload = () => {
                const canvas = document.createElement('canvas');
                let width = image.width;
                let height = image.height;
                if (width > maxWidth) {
                    height *= maxWidth / width;
                    width = maxWidth;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(image, 0, 0, width, height);
                    const dataUrl = canvas.toDataURL('image/jpeg', quality);
                    const byteString = atob(dataUrl.split(',')[1]);
                    const ab = new ArrayBuffer(byteString.length);
                    const ia = new Uint8Array(ab);
                    for (let i = 0; i < byteString.length; i++) {
                        ia[i] = byteString.charCodeAt(i);
                    }
                    const blob = new Blob([ab], { type: 'image/jpeg' });
                    const resizedFile = new File([blob], file.name, { type: 'image/jpeg' });
                    resolve(resizedFile);
                } else {
                    resolve(file); // Fallback
                }
            };
            image.src = readerEvent.target.result;
        };
        reader.onerror = (e) => reject(e);
        reader.readAsDataURL(file);
    });
};

// Funções utilitárias para evitar bugs de fuso horário (timezone shift) no JavaScript
const formatDbDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '-';
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length === 3) {
        const [y, m, d] = parts;
        return `${d}/${m}/${y}`;
    }
    return new Date(dateStr).toLocaleDateString('pt-BR');
};

const getDurationDays = (startStr: string, endStr: string): number => {
    if (!startStr || !endStr) return 0;
    const startParts = startStr.split('T')[0].split('-');
    const endParts = endStr.split('T')[0].split('-');
    if (startParts.length === 3 && endParts.length === 3) {
        const startDate = new Date(Number(startParts[0]), Number(startParts[1]) - 1, Number(startParts[2]));
        const endDate = new Date(Number(endParts[0]), Number(endParts[1]) - 1, Number(endParts[2]));
        return Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    }
    return 0;
};

const isDateWithinRange = (dateStr: string, startStr: string, endStr: string): boolean => {
    if (!dateStr || !startStr || !endStr) return false;
    const date = new Date(dateStr.split('T')[0] + 'T00:00:00');
    const start = new Date(startStr.split('T')[0] + 'T00:00:00');
    const end = new Date(endStr.split('T')[0] + 'T00:00:00');
    return date >= start && date <= end;
};

const getAvailablePeriods = (admissionDateStr: string | null | undefined): string[] => {
    const periods: string[] = [];
    const now = new Date();
    const currentYear = now.getFullYear();

    if (admissionDateStr) {
        const parts = admissionDateStr.split('-');
        if (parts.length === 3) {
            const admYear = parseInt(parts[0]);
            for (let y = admYear; y <= currentYear + 1; y++) {
                periods.push(y.toString());
            }
            return periods.reverse();
        }
    }

    for (let y = currentYear - 3; y <= currentYear + 1; y++) {
        periods.push(y.toString());
    }
    return periods.reverse();
};

const getPeriodDeadline = (admissionDateStr: string | null | undefined, periodYearStr: string): Date | null => {
    if (!admissionDateStr || !periodYearStr) return null;
    const parts = admissionDateStr.split('-');
    if (parts.length !== 3) return null;
    const admMonth = parseInt(parts[1]) - 1;
    const admDay = parseInt(parts[2]);
    const periodYear = parseInt(periodYearStr);
    
    const deadline = new Date(periodYear + 2, admMonth, admDay);
    deadline.setDate(deadline.getDate() - 1);
    return deadline;
};

const MobileFriendlyDateInput: React.FC<{
    label: string;
    value: string | null | undefined;
    onChange: (val: string) => void;
    disabled?: boolean;
}> = ({ label, value, onChange, disabled }) => {
    // Internal state for text input (DD/MM/YYYY)
    const [textValue, setTextValue] = useState('');

    useEffect(() => {
        if (value) {
            const [y, m, d] = value.split('-');
            setTextValue(`${d}/${m}/${y}`);
        } else {
            setTextValue('');
        }
    }, [value]);

    const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value.replace(/\D/g, ''); // Remove non-digits
        if (val.length > 8) val = val.substring(0, 8);

        // Simple mask logic
        let formatted = val;
        if (val.length >= 3) formatted = `${val.substring(0, 2)}/${val.substring(2)}`;
        if (val.length >= 5) formatted = `${formatted.substring(0, 5)}/${formatted.substring(5)}`;

        setTextValue(formatted);

        // Parse if complete
        if (val.length === 8) {
            const day = val.substring(0, 2);
            const month = val.substring(2, 4);
            const year = val.substring(4, 8);
            // Basic validity check
            const date = new Date(`${year}-${month}-${day}`);
            if (!isNaN(date.getTime())) {
                onChange(`${year}-${month}-${day}`);
            }
        } else if (val.length === 0) {
            onChange('');
        }
    };

    const handleDateSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(e.target.value);
    };

    return (
        <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase">{label}</label>
            <div className="relative mt-1">
                <input
                    type="text"
                    disabled={disabled}
                    placeholder="DD/MM/AAAA"
                    className="w-full p-2 border rounded-lg disabled:bg-slate-100 pr-10"
                    value={textValue}
                    onChange={handleTextChange}
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-2">
                    <div className="relative">
                        <input
                            type="date"
                            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                            onChange={handleDateSelect}
                            value={value || ''}
                            disabled={disabled}
                        />
                        <button type="button" tabIndex={-1} className="text-slate-400 hover:text-blue-500">
                            <ClockIcon className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- DASHBOARD COMPONENT ---
const DashboardRH: React.FC<{ employees: Employee[], absences: EmployeeAbsence[], vacations: EmployeeVacation[] }> = ({ employees, absences, vacations }) => {
    const totalEmployees = employees.length;
    const activeEmployees = employees.filter(e => e.active).length;
    const inactiveEmployees = totalEmployees - activeEmployees;

    // Simple analysis
    const currentlyOnVacation = vacations.filter(v => {
        if (v.status !== 'Gozada' && v.status !== 'Agendada' && v.status !== 'Programada') return false;
        const todayStr = new Date().toISOString().split('T')[0];
        return isDateWithinRange(todayStr, v.startDate, v.endDate);
    }).length;

    const recentAbsences = absences.length; // Could filter by date

    // Birthday calculations
    const birthdayAlerts = useMemo(() => {
        const alerts: { employee: Employee; daysUntil: number; isToday: boolean; birthDateStr: string; age: number }[] = [];
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentDate = now.getDate();

        employees.forEach(emp => {
            if (!emp.birthDate || !emp.active) return;
            // Parse YYYY-MM-DD manually to avoid timezone shifting
            const parts = emp.birthDate.split('-');
            if (parts.length !== 3) return;
            const birthYear = parseInt(parts[0]);
            const birthMonth = parseInt(parts[1]) - 1; // 0-indexed
            const birthDay = parseInt(parts[2]);

            let nextBirthday = new Date(now.getFullYear(), birthMonth, birthDay);
            
            // If birthday has already occurred this year, check next year's birthday
            if (nextBirthday < new Date(now.getFullYear(), currentMonth, currentDate)) {
                nextBirthday.setFullYear(now.getFullYear() + 1);
            }

            const diffTime = nextBirthday.getTime() - new Date(now.getFullYear(), currentMonth, currentDate).getTime();
            const daysUntil = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            const isToday = birthMonth === currentMonth && birthDay === currentDate;
            const age = nextBirthday.getFullYear() - birthYear;

            // Show alert if birthday is today or within the next 15 days
            if (isToday || daysUntil <= 15) {
                const formattedBirthDate = `${birthDay.toString().padStart(2, '0')}/${(birthMonth + 1).toString().padStart(2, '0')}`;
                alerts.push({
                    employee: emp,
                    daysUntil: isToday ? 0 : daysUntil,
                    isToday,
                    birthDateStr: formattedBirthDate,
                    age
                });
            }
        });

        return alerts.sort((a, b) => a.daysUntil - b.daysUntil);
    }, [employees]);

    // Vacation expiration calculations (Férias Vencendo/A Vencer)
    const vacationAlerts = useMemo(() => {
        const alerts: { employee: Employee; periodStr: string; daysRemaining: number; deadlineStr: string; daysToDeadline: number; isOverdue: boolean }[] = [];
        const now = new Date();

        employees.forEach(emp => {
            if (!emp.admissionDate || !emp.active) return;
            
            const parts = emp.admissionDate.split('-');
            if (parts.length !== 3) return;
            const admYear = parseInt(parts[0]);
            const admMonth = parseInt(parts[1]) - 1;
            const admDay = parseInt(parts[2]);
            const admission = new Date(admYear, admMonth, admDay);

            // Calculate how many completed years since admission
            const yearsWorked = Math.floor((now.getTime() - admission.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
            
            // Check periods for each completed year
            for (let i = 0; i < yearsWorked; i++) {
                const periodStart = new Date(admission);
                periodStart.setFullYear(admission.getFullYear() + i);
                const periodEnd = new Date(admission);
                periodEnd.setFullYear(admission.getFullYear() + i + 1);
                
                // Deadline to take this vacation is 1 year after the period ends (so admissionDate + i + 2 years)
                const deadline = new Date(admission);
                deadline.setFullYear(admission.getFullYear() + i + 2);
                deadline.setDate(deadline.getDate() - 1); // Deadline is usually the day before the anniversary of the 2nd year

                const startYear = periodStart.getFullYear();
                const periodStr = startYear.toString();

                // Find all vacations for this employee that match this period
                const empVacations = vacations.filter(v => {
                    if (v.employeeId !== emp.id) return false;
                    if (!v.period) return false;
                    
                    const normPeriod = v.period.trim();
                    return normPeriod === periodStr || normPeriod.startsWith(periodStr);
                });

                // Calculate total days taken/scheduled/sold
                let daysUsed = 0;
                empVacations.forEach(v => {
                    if (v.status === 'Cancelada') return;
                    const days = getDurationDays(v.startDate, v.endDate);
                    if (!isNaN(days)) {
                        daysUsed += days;
                    }
                });

                const daysRemaining = 30 - daysUsed;

                if (daysRemaining > 0) {
                    const diffTime = deadline.getTime() - now.getTime();
                    const daysToDeadline = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    const isOverdue = daysToDeadline < 0;

                    // Show alert if overdue or if deadline is in less than 90 days
                    if (isOverdue || daysToDeadline <= 90) {
                        alerts.push({
                            employee: emp,
                            periodStr,
                            daysRemaining,
                            deadlineStr: deadline.toLocaleDateString('pt-BR'),
                            daysToDeadline,
                            isOverdue
                        });
                    }
                }
            }
        });

        return alerts.sort((a, b) => a.daysToDeadline - b.daysToDeadline);
    }, [employees, vacations]);

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

            {/* SEÇÃO DE ALERTAS E LEMBRETES DE RH */}
            {(birthdayAlerts.length > 0 || vacationAlerts.length > 0) && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 animate-fadeIn">
                    <h3 className="font-extrabold text-[#0F3F5C] text-lg mb-4 border-b pb-2 flex items-center gap-2">
                        <ExclamationIcon className="h-5 w-5 text-amber-500" />
                        Lembretes e Alertas de RH
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Alertas de Aniversário */}
                        {birthdayAlerts.length > 0 && (
                            <div className="bg-pink-50/30 p-4 rounded-xl border border-pink-100/50">
                                <h4 className="font-bold text-pink-700 text-sm mb-3 flex items-center gap-1.5">
                                    🎂 Próximos Aniversários
                                </h4>
                                <ul className="space-y-3">
                                    {birthdayAlerts.map(({ employee, daysUntil, isToday, birthDateStr, age }) => (
                                        <li key={employee.id} className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-pink-100/30 shadow-sm text-sm">
                                            <div>
                                                <span className="font-bold text-slate-800">{employee.name}</span>
                                                <span className="text-xs text-slate-500 ml-1">({age} anos • {birthDateStr})</span>
                                            </div>
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                                isToday ? 'bg-pink-100 text-pink-700 animate-pulse' : 'bg-slate-100 text-slate-600'
                                            }`}>
                                                {isToday ? 'Faz aniversário hoje! 🎉' : `Em ${daysUntil} ${daysUntil === 1 ? 'dia' : 'dias'}`}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Alertas de Férias a Vencer */}
                        {vacationAlerts.length > 0 && (
                            <div className="bg-amber-50/30 p-4 rounded-xl border border-amber-100/50">
                                <h4 className="font-bold text-amber-700 text-sm mb-3 flex items-center gap-1.5">
                                    📅 Férias a Vencer / Vencidas
                                </h4>
                                <ul className="space-y-3">
                                    {vacationAlerts.map(({ employee, periodStr, daysRemaining, deadlineStr, daysToDeadline, isOverdue }) => (
                                        <li key={`${employee.id}-${periodStr}`} className="flex flex-col bg-white p-2.5 rounded-lg border border-amber-100/30 shadow-sm text-sm">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <span className="font-bold text-slate-800">{employee.name}</span>
                                                    <span className="text-xs text-slate-500 block">Período Aquisitivo: {periodStr}</span>
                                                </div>
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold shrink-0 ${
                                                    isOverdue ? 'bg-red-100 text-red-700 font-extrabold animate-pulse' : 'bg-amber-100 text-amber-700'
                                                }`}>
                                                    {isOverdue ? 'FÉRIAS VENCIDAS ⚠️' : `Vence em ${daysToDeadline} ${daysToDeadline === 1 ? 'dia' : 'dias'}`}
                                                </span>
                                            </div>
                                            <div className="mt-2 text-xs flex justify-between text-slate-600 border-t pt-1.5 border-dashed">
                                                <span>Dias em haver: <strong>{daysRemaining} dias</strong></span>
                                                <span>Prazo: {deadlineStr}</span>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Graphs / Lists could go here */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <h3 className="font-bold text-slate-700 mb-4">Colaboradores em Férias</h3>
                {vacations.filter(v => {
                    if (v.status !== 'Gozada' && v.status !== 'Agendada' && v.status !== 'Programada') return false;
                    const todayStr = new Date().toISOString().split('T')[0];
                    return v.endDate >= todayStr;
                }).length > 0 ? (
                    <table className="w-full text-sm">
                        <thead className="text-left bg-slate-50 text-slate-500 uppercase text-xs">
                            <tr><th className="p-2">Colaborador</th><th className="p-2">Início</th><th className="p-2">Fim</th><th className="p-2">Status</th></tr>
                        </thead>
                        <tbody>
                            {vacations.filter(v => {
                                if (v.status !== 'Gozada' && v.status !== 'Agendada' && v.status !== 'Programada') return false;
                                const todayStr = new Date().toISOString().split('T')[0];
                                return v.endDate >= todayStr;
                            }).map(v => {
                                const emp = employees.find(e => e.id === v.employeeId);
                                return (
                                    <tr key={v.id} className="border-b">
                                        <td className="p-2 font-bold">{emp?.name || 'Desconhecido'}</td>
                                        <td className="p-2">{formatDbDate(v.startDate)}</td>
                                        <td className="p-2">{formatDbDate(v.endDate)}</td>
                                        <td className="p-2">
                                            <span className={`px-2 py-0.5 rounded text-xs font-bold border ${
                                                v.status === 'Gozada' 
                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                                    : 'bg-blue-50 text-blue-700 border-blue-200'
                                            }`}>
                                                {v.status === 'Gozada' ? 'Em Gozo' : 'Agendada'}
                                            </span>
                                        </td>
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
const EmployeeCard: React.FC<{ employee: Employee; onSelect: () => void; onDelete: () => void; evaluations: Evaluation[] }> = React.memo(({ employee, onSelect, onDelete, evaluations }) => {
    const employeeEvals = evaluations.filter(e => e.employeeId === employee.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const lastEvaluation = employeeEvals[0];
    const displayScore = lastEvaluation ? (lastEvaluation.totalScore / 5) : 0;

    return (
        <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all border border-slate-100 p-4 flex items-center space-x-4 relative group">
            <div onClick={onSelect} className="flex-grow flex items-center space-x-4 cursor-pointer">
                <div className="h-16 w-16 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden border-2 border-slate-100 shrink-0">
                    {employee.photoUrl ? (
                        <img src={employee.photoUrl} alt={employee.name} className="h-full w-full object-cover" loading="lazy" />
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
});


// ... EmployeeDetailModal (Same as before) ...
const EmployeeDetailModal: React.FC<{
    employee: Employee;
    onClose: () => void;
    onSave: () => void;
    onDelete: () => void; // New prop
    currentUser: User | null;
    readOnly?: boolean;
    initialTab?: 'profile' | 'responsibilities' | 'development' | 'hr' | 'evaluations' | 'documents' | 'tasks';
    orgUnits?: OrgUnit[];
    orgPositions?: OrgPosition[];
}> = ({ employee, onClose, onSave, onDelete, currentUser, readOnly, initialTab = 'profile', orgUnits = [], orgPositions = [] }) => {
    // ... Copy existing implementation or use a placeholder if too long (I'll keep it shortened for this specific file write as the focus is Organograma)
    // To ensure I don't break existing features, I will replicate it or assume it's there. 
    // Given the previous step saw the full file, I will perform a full overwrite including the Modal code to be safe.

    const [activeTab, setActiveTab] = useState<'profile' | 'responsibilities' | 'development' | 'hr' | 'evaluations' | 'documents' | 'tasks'>(initialTab);
    const [empData, setEmpData] = useState<Employee>(employee);
    const [responsibilities, setResponsibilities] = useState<EmployeeResponsibility[]>([]);
    const [courses, setCourses] = useState<EmployeeCourse[]>([]);
    const [absences, setAbsences] = useState<EmployeeAbsence[]>([]);
    const [vacations, setVacations] = useState<EmployeeVacation[]>([]);
    const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
    const [kaizenTasks, setKaizenTasks] = useState<KaizenProblem[]>([]);
    const [newResp, setNewResp] = useState('');

    // Refs for file inputs to ensure reliable mobile triggering
    const profilePhotoInputRef = useRef<HTMLInputElement>(null);
    const courseFileInputRef = useRef<HTMLInputElement>(null);
    const absenceFileInputRef = useRef<HTMLInputElement>(null);
    const [newCourse, setNewCourse] = useState('');
    const [isUploading, setIsUploading] = useState(false); // New state for feedback
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
    const periodsOptions = useMemo(() => getAvailablePeriods(employee.admissionDate), [employee.admissionDate]);
    const [newVacation, setNewVacation] = useState({ period: periodsOptions[0] || '', startDate: '', endDate: '', status: 'Agendada' });

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
            } as any);
            alert('Ausência registrada');
            setNewAbsence({ type: 'Falta Injustificada', startDate: '', endDate: '', reason: '' });
            setAbsenceFile(null);
            loadDetails();
        } catch (e) {
            console.error(e);
            alert('Erro ao registrar ausência. Verifique se criou a coluna attachment_url no banco.');
        }
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
                status: newVacation.status || 'Agendada'
            } as any);
            alert('Férias registradas com sucesso!');
            setNewVacation({ period: periodsOptions[0] || '', startDate: '', endDate: '', status: 'Agendada' });
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
                } as any);
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
        let file = e.target.files[0];

        setIsUploading(true);
        try {
            // Compress image if it's large
            if (file.size > 1024 * 1024) { // Only resize if > 1MB
                try {
                    file = await resizeImage(file);
                } catch (err) { console.error("Error resizing", err); }
            }

            const fileName = `avatars/${employee.id}_${Date.now()}_normalized.jpg`;
            const publicUrl = await uploadFile('kb-files', fileName, file);
            if (publicUrl) {
                // Force a query param to bust cache
                const urlWithCacheBust = `${publicUrl}?t=${Date.now()}`;
                const updated = await updateItem('employees', employee.id, { photoUrl: urlWithCacheBust });
                setEmpData({ ...empData, photoUrl: urlWithCacheBust });
                // Also update local list if possible? Ideally reloadData but we are in modal.
                // We'll trust onSave() or next reload.
                alert('Foto atualizada com sucesso!');
            }
        } catch (error) {
            console.error(error);
            alert('Erro ao atualizar foto. Tente uma imagem menor.');
        } finally {
            setIsUploading(false);
            // Clear input
            if (profilePhotoInputRef.current) profilePhotoInputRef.current.value = '';
        }
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

            // Fetch Kaizen Tasks
            try {
                const allProblems = await fetchTable<KaizenProblem>('kaizen_problems');
                const employeeTasks = allProblems.filter(p => {
                    const isResponsibleId = p.responsibleIds?.includes(employee.id);
                    const isResponsibleName = p.responsible && p.responsible.includes(employee.name); // Backward compatibility
                    return (isResponsibleId || isResponsibleName) && p.status !== 'Resolvido';
                });
                setKaizenTasks(employeeTasks);
            } catch (kErr) { console.error('Error fetching kaizen tasks', kErr); }

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

    // Development Handlers
    const handleAddCourse = async () => {
        if (!newCourseData.courseName) return;
        try {
            let attachmentUrl = null;
            if (courseFile) {
                const fileName = `courses/${employee.id}_${Date.now()}_${courseFile.name}`;
                attachmentUrl = await uploadFile('kb-files', fileName, courseFile);
            }

            const added = await insertItem('employee_courses', {
                employeeId: employee.id,
                courseName: newCourseData.courseName,
                institution: newCourseData.institution,
                educationType: newCourseData.educationType,
                completionDate: newCourseData.completionDate || null,
                workloadHours: newCourseData.workloadHours ? parseFloat(newCourseData.workloadHours) : null,
                status: 'Concluído',
                attachmentUrl: attachmentUrl
            } as any);

            setCourses([...courses, added as EmployeeCourse]);
            alert('Qualificação adicionada!');
            setNewCourseData({ educationType: 'Curso Livre', courseName: '', institution: '', completionDate: '', workloadHours: '' });
            setCourseFile(null);
            loadDetails();
        } catch (e) {
            console.error(e);
            alert('Erro ao registrar curso. Verifique se executou o script SQL.');
        }
    };

    const handleDeleteCourse = async (id: string) => {
        if (!confirm('Remover esta qualificação?')) return;
        await deleteItem('employee_courses', id);
        loadDetails();
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
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-0 md:p-4">
            <div className="bg-white md:rounded-2xl shadow-2xl w-full md:max-w-4xl h-full md:h-[90vh] flex flex-col overflow-hidden">
                <div className="bg-slate-50 p-6 border-b border-slate-200 flex justify-between items-start">
                    <div className="flex items-center space-x-4">
                        <div className="h-20 w-20 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden border-4 border-white shadow-sm relative group">
                            {empData.photoUrl ? <img src={empData.photoUrl} alt={empData.name} className={`h-full w-full object-cover transition-opacity ${isUploading ? 'opacity-50' : ''}`} /> : <span className="text-3xl font-bold text-slate-400">{empData.name.charAt(0)}</span>}

                            {/* Loading Spinner */}
                            {isUploading && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-20">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                                </div>
                            )}

                            <div onClick={() => !readOnly && !isUploading && profilePhotoInputRef.current?.click()} className={`absolute inset-0 bg-black/30 flex items-center justify-center cursor-pointer transition ${readOnly ? 'hidden' : ''} ${isUploading ? 'hidden' : ''}`}>
                                <PencilIcon className="text-white h-6 w-6 opacity-70 hover:opacity-100" />
                                <input
                                    ref={profilePhotoInputRef}
                                    type="file"
                                    accept="image/*"
                                    capture="user"
                                    className="hidden"
                                    onChange={handleUpdatePhoto}
                                    disabled={readOnly || isUploading}
                                />
                            </div>
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
                        {empData.orgPositionId && (
                            <button
                                onClick={() => { onClose(); onSave(); /* Signal parent to switch view? We can just tell the user to switch to Org Chart */ alert('Mude para a aba "Organograma" para visualizar este colaborador na hierarquia.'); }}
                                className="text-amber-500 hover:text-amber-600 p-2 rounded-full hover:bg-amber-50 transition"
                                title="Localizar no Organograma"
                            >
                                <ChartBarIcon className="h-5 w-5" />
                            </button>
                        )}
                        {!readOnly && (
                            <button onClick={onDelete} className="text-red-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition" title="Excluir Este Funcionário">
                                <TrashIcon className="h-5 w-5" />
                            </button>
                        )}
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-200 transition">✕</button>
                    </div>
                </div>
                <div className="flex border-b border-slate-200 bg-white overflow-x-auto no-scrollbar">
                    {[
                        { id: 'profile', label: 'Resumo / Perfil', icon: <UserIcon className="h-4 w-4" /> },
                        { id: 'responsibilities', label: 'Atribuições', icon: <DocumentTextIcon className="h-4 w-4" /> },
                        { id: 'development', label: 'Desenvolvimento', icon: <BookOpenIcon className="h-4 w-4" /> },
                        { id: 'hr', label: 'RH (Férias/Faltas)', icon: <ClockIcon className="h-4 w-4" /> },
                        { id: 'documents', label: 'Documentos', icon: <DocumentTextIcon className="h-4 w-4" /> },
                        { id: 'evaluations', label: 'Avaliações', icon: <StarIcon className="h-4 w-4" /> },
                        { id: 'tasks', label: 'Pendências', icon: <CheckCircleIcon className="h-4 w-4" /> },
                    ].map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`relative flex items-center space-x-2 px-6 py-4 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === tab.id ? 'border-[#0F3F5C] text-[#0F3F5C] bg-slate-50' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>
                            {tab.icon} <span>{tab.label}</span>
                            {tab.id === 'tasks' && kaizenTasks.length > 0 && (
                                <span className="absolute top-2 right-2 flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                                </span>
                            )}
                        </button>
                    ))}
                </div>
                <div className="flex-grow overflow-y-auto p-6 bg-slate-50">
                    {activeTab === 'profile' && (
                        <form onSubmit={handleUpdateProfile} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                                <h3 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">Dados Pessoais</h3>
                                <div className="space-y-4">
                                    <div><label className="block text-xs font-semibold text-slate-500 uppercase">Nome Completo</label><input type="text" disabled={readOnly} className="w-full mt-1 p-2 border rounded-lg disabled:bg-slate-100" value={empData.name} onChange={e => setEmpData({ ...empData, name: e.target.value })} /></div>
                                    <MobileFriendlyDateInput label="Data Nascimento" value={empData.birthDate} onChange={v => setEmpData({ ...empData, birthDate: v })} disabled={readOnly} />
                                    <div><label className="block text-xs font-semibold text-slate-500 uppercase">Estado Civil</label><select disabled={readOnly} className="w-full mt-1 p-2 border rounded-lg disabled:bg-slate-100" value={empData.maritalStatus || ''} onChange={e => setEmpData({ ...empData, maritalStatus: e.target.value })}><option value="">Selecione</option><option value="Solteiro(a)">Solteiro(a)</option><option value="Casado(a)">Casado(a)</option><option value="Divorciado(a)">Divorciado(a)</option></select></div>
                                    <div><label className="block text-xs font-semibold text-slate-500 uppercase">Filhos</label><input type="number" disabled={readOnly} className="w-full mt-1 p-2 border rounded-lg disabled:bg-slate-100" value={empData.childrenCount || 0} onChange={e => setEmpData({ ...empData, childrenCount: parseInt(e.target.value) })} /></div>
                                    <div><label className="block text-xs font-semibold text-slate-500 uppercase">Telefone / Contato</label><input type="text" disabled={readOnly} className="w-full mt-1 p-2 border rounded-lg disabled:bg-slate-100" value={empData.phone || ''} onChange={e => setEmpData({ ...empData, phone: e.target.value })} /></div>
                                </div>
                            </div>
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                                <h3 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">Dados Profissionais</h3>
                                <div className="space-y-4">
                                    {/* Link to Org Chart Position */}
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 uppercase">Posição no Organograma (Vínculo Hierárquico)</label>
                                        <select
                                            disabled={readOnly}
                                            className="w-full mt-1 p-2 border rounded-lg disabled:bg-slate-100 bg-blue-50/50 font-bold text-[#0F3F5C]"
                                            value={empData.orgPositionId || ''}
                                            onChange={e => {
                                                const posId = e.target.value;
                                                const selectedPos = orgPositions.find(p => p.id === posId);
                                                const selectedUnit = orgUnits.find(u => u.id === selectedPos?.orgUnitId);

                                                setEmpData({
                                                    ...empData,
                                                    orgPositionId: posId || undefined,
                                                    jobTitle: selectedPos?.title || empData.jobTitle,
                                                    sector: selectedUnit?.name || empData.sector
                                                });
                                            }}
                                        >
                                            <option value="">Não Vinculado ao Organograma</option>
                                            {orgUnits.map(unit => (
                                                <optgroup key={unit.id} label={unit.name}>
                                                    {orgPositions.filter(p => p.orgUnitId === unit.id).map(p => (
                                                        <option key={p.id} value={p.id}>{p.title}</option>
                                                    ))}
                                                </optgroup>
                                            ))}
                                        </select>
                                        <p className="text-[10px] text-slate-400 mt-1 italic">* Ao selecionar uma posição, o Cargo e Setor serão atualizados automaticamente.</p>
                                    </div>

                                    {/* Job Description from OrgPosition */}
                                    {empData.orgPositionId && orgPositions.find(p => p.id === empData.orgPositionId)?.description && (
                                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                            <label className="block text-xs font-bold text-[#0F3F5C] uppercase mb-1 flex items-center gap-1">
                                                <DocumentTextIcon className="h-3 w-3" /> Descrição de Cargo (Organograma)
                                            </label>
                                            <div className="text-xs text-slate-600 whitespace-pre-wrap italic">
                                                {orgPositions.find(p => p.id === empData.orgPositionId)?.description}
                                            </div>
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 uppercase">Cargo / Função (Exibição)</label>
                                        <input type="text" disabled={readOnly} className="w-full mt-1 p-2 border rounded-lg disabled:bg-slate-100" value={empData.jobTitle || ''} onChange={e => setEmpData({ ...empData, jobTitle: e.target.value })} placeholder="Ex: Operador Trefila I" />
                                    </div>
                                    <MobileFriendlyDateInput label="Data Admissão" value={empData.admissionDate} onChange={v => setEmpData({ ...empData, admissionDate: v })} disabled={readOnly} />
                                    <div className="grid grid-cols-1 gap-4">
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-500 uppercase">Setor (Exibição)</label>
                                            <input type="text" disabled={readOnly} className="w-full mt-1 p-2 border rounded-lg disabled:bg-slate-100" value={empData.sector} onChange={e => setEmpData({ ...empData, sector: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-500 uppercase">Máquina Atribuída (Para Ordem de Produção)</label>
                                            <select
                                                disabled={readOnly}
                                                className="w-full mt-1 p-2 border rounded-lg disabled:bg-slate-100"
                                                value={empData.assignedMachine || ''}
                                                onChange={e => setEmpData({ ...empData, assignedMachine: e.target.value })}
                                            >
                                                <option value="">Sem máquina específica (Todas permitidas)</option>
                                                <option value="Trefila 1">Trefila 1</option>
                                                <option value="Trefila 2">Trefila 2</option>
                                                <option value="Treliça 1">Treliça 1</option>
                                                <option value="Treliça 2">Treliça 2</option>
                                            </select>
                                        </div>
                                    </div>
                                    {!readOnly && <div className="pt-4 flex justify-end"><button type="submit" className="bg-[#0F3F5C] text-white font-bold py-2 px-6 rounded-lg hover:bg-[#0A2A3D] transition">Salvar Alterações</button></div>}
                                </div>
                            </div>
                        </form>
                    )}
                    {activeTab === 'responsibilities' && (
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                            {!readOnly && <div className="flex gap-2 mb-6"><input className="flex-grow p-2 border rounded-lg" placeholder="Adicionar nova responsabilidade..." value={newResp} onChange={e => setNewResp(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddResponsibility()} /><button onClick={handleAddResponsibility} className="bg-green-600 text-white px-4 rounded-lg hover:bg-green-700">Adicionar</button></div>}
                            <ul className="space-y-2">{responsibilities.map(r => (<li key={r.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100"><span className="text-slate-700">{r.description}</span>{!readOnly && <button onClick={() => handleDeleteResponsibility(r.id)} className="text-red-500 hover:text-red-700"><TrashIcon className="h-4 w-4" /></button>}</li>))} {responsibilities.length === 0 && <p className="text-slate-400 text-center py-4">Nenhuma atribuição cadastrada.</p>}</ul>
                        </div>
                    )}
                    {activeTab === 'development' && (
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                            <h3 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2 flex items-center gap-2">
                                <BookOpenIcon className="h-5 w-5 text-blue-500" />
                                Histórico Educacional e Cursos
                            </h3>
                            {!readOnly && (
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
                                        <MobileFriendlyDateInput label="Data Conclusão" value={newCourseData.completionDate} onChange={v => setNewCourseData({ ...newCourseData, completionDate: v })} disabled={readOnly} />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500">Carga Horária (h)</label>
                                        <input type="number" className="w-full p-2 border rounded" placeholder="Ex: 40" value={newCourseData.workloadHours} onChange={e => setNewCourseData({ ...newCourseData, workloadHours: e.target.value })} />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="text-xs font-bold text-slate-500">Certificado (PDF/Img)</label>
                                        <input
                                            ref={courseFileInputRef}
                                            type="file"
                                            accept="image/*"
                                            capture="environment"
                                            className="hidden"
                                            onChange={(e) => setCourseFile(e.target.files ? e.target.files[0] : null)}
                                        />
                                        <button
                                            onClick={() => courseFileInputRef.current?.click()}
                                            className="w-full py-2 px-4 border border-dashed border-blue-300 rounded-lg text-blue-600 bg-blue-50 hover:bg-blue-100 text-xs font-bold flex items-center justify-center gap-2"
                                        >
                                            <DocumentTextIcon className="h-4 w-4" />
                                            {courseFile ? 'Arquivo Selecionado (Clique para alterar)' : 'Tirar Foto ou Escolher Arquivo'}
                                        </button>
                                    </div>
                                    <div className="flex items-end">
                                        <button onClick={handleAddCourse} className="w-full bg-blue-600 text-white font-bold py-2 rounded hover:bg-blue-700 transition">Adicionar Qualificação</button>
                                    </div>
                                </div>
                            )}

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
                                                    {!readOnly && <button onClick={() => handleDeleteCourse(c.id)} className="text-red-400 hover:text-red-600"><TrashIcon className="h-4 w-4" /></button>}
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
                            {!readOnly && (
                                !isEvaluating ? (<button onClick={() => setIsEvaluating(true)} className="w-full bg-[#0F3F5C] text-white font-bold py-3 rounded-xl hover:bg-[#0A2A3D] transition shadow-md">+ Nova Avaliação Rápida</button>) : (
                                    <div className="bg-white p-6 rounded-xl border border-blue-100 shadow-md">
                                        <h4 className="font-bold text-lg mb-4 text-[#0F3F5C]">Nova Avaliação</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">{[{ key: 'organization', label: 'Organização' }, { key: 'cleanliness', label: 'Limpeza Máquina' }, { key: 'effort', label: 'Empenho' }, { key: 'communication', label: 'Comunicação' }, { key: 'improvement', label: 'Melhoria' }].map(cat => (<div key={cat.key} className="flex justify-between items-center bg-slate-50 p-3 rounded-lg"><span className="text-sm font-medium">{cat.label}</span>{/* @ts-ignore */}<StarRating score={evalScores[cat.key]} onChange={v => setEvalScores({ ...evalScores, [cat.key]: v })} /></div>))}</div>
                                        <textarea className="w-full border p-2 rounded-lg text-sm mb-4" placeholder="Observação..." value={evalNote} onChange={e => setEvalNote(e.target.value)} /><div className="flex justify-end gap-3"><button onClick={() => setIsEvaluating(false)} className="text-slate-500 hover:text-slate-700">Cancelar</button><button onClick={handleSubmitEvaluation} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold">Salvar Avaliação</button></div>
                                    </div>
                                )
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
                                {!readOnly && (
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
                                            <MobileFriendlyDateInput label="Data Início" value={newAbsence.startDate} onChange={v => setNewAbsence({ ...newAbsence, startDate: v })} disabled={readOnly} />
                                        </div>
                                        <div>
                                            <MobileFriendlyDateInput label="Data Fim (Opcional)" value={newAbsence.endDate} onChange={v => setNewAbsence({ ...newAbsence, endDate: v })} disabled={readOnly} />
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
                                                ref={absenceFileInputRef}
                                                type="file"
                                                accept="image/*"
                                                capture="environment"
                                                className="hidden"
                                                onChange={(e) => setAbsenceFile(e.target.files ? e.target.files[0] : null)}
                                            />
                                            <button
                                                onClick={() => absenceFileInputRef.current?.click()}
                                                className="w-full py-2 px-4 border border-dashed border-blue-300 rounded-lg text-blue-600 bg-blue-50 hover:bg-blue-100 text-xs font-bold flex items-center justify-center gap-2"
                                            >
                                                <DocumentTextIcon className="h-4 w-4" />
                                                {absenceFile ? 'Arquivo Selecionado' : 'Anexar Foto/Atestado'}
                                            </button>
                                        </div>
                                    </div>
                                )}
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
                                                        {!readOnly && <button onClick={() => handleDeleteAbsence(abs.id)} className="text-red-400 hover:text-red-600"><TrashIcon className="h-4 w-4" /></button>}
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
                                {!readOnly && (
                                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4 bg-blue-50/50 border border-blue-100 p-4 rounded-xl">
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase">Período Aquisitivo</label>
                                            <select className="w-full mt-1 p-2 border rounded-lg bg-white" value={newVacation.period} onChange={e => setNewVacation({ ...newVacation, period: e.target.value })}>
                                                <option value="">Selecione</option>
                                                {periodsOptions.map(p => (
                                                    <option key={p} value={p}>{p}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <MobileFriendlyDateInput label="Início do Gozo" value={newVacation.startDate} onChange={v => setNewVacation({ ...newVacation, startDate: v })} disabled={readOnly} />
                                        </div>
                                        <div>
                                            <MobileFriendlyDateInput label="Fim do Gozo" value={newVacation.endDate} onChange={v => setNewVacation({ ...newVacation, endDate: v })} disabled={readOnly} />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase">Status</label>
                                            <select className="w-full mt-1 p-2 border rounded-lg bg-white" value={newVacation.status || 'Agendada'} onChange={e => setNewVacation({ ...newVacation, status: e.target.value })}>
                                                <option value="Agendada">Agendada</option>
                                                <option value="Programada">Programada</option>
                                                <option value="Gozada">Gozada (Tirada)</option>
                                                <option value="Vendida">Vendida (Abono)</option>
                                                <option value="Cancelada">Cancelada</option>
                                            </select>
                                        </div>
                                        <div className="flex flex-col justify-end">
                                            <button onClick={handleAddVacation} className="bg-blue-600 text-white font-bold py-2.5 px-4 rounded-lg hover:bg-blue-700 transition">Registrar Férias</button>
                                        </div>
                                    </div>
                                )}
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-100 text-slate-600 font-bold">
                                            <tr>
                                                <th className="p-3">Período Aquisitivo</th>
                                                <th className="p-3">Data de Gozo</th>
                                                <th className="p-3">Duração</th>
                                                <th className="p-3">Status</th>
                                                <th className="p-3 text-center">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {vacations.map(vac => {
                                                const durationDays = getDurationDays(vac.startDate, vac.endDate);
                                                return (
                                                    <tr key={vac.id} className="border-b hover:bg-slate-50">
                                                        <td className="p-3 font-semibold text-slate-700">{vac.period}</td>
                                                        <td className="p-3 text-slate-600">
                                                            {formatDbDate(vac.startDate)} a {formatDbDate(vac.endDate)}
                                                        </td>
                                                        <td className="p-3 text-slate-600 font-medium">
                                                            {isNaN(durationDays) ? '-' : `${durationDays} ${durationDays === 1 ? 'dia' : 'dias'}`}
                                                        </td>
                                                        <td className="p-3">
                                                            <span className={`px-2 py-1 rounded text-xs font-bold border ${
                                                                vac.status === 'Gozada' 
                                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                                                    : vac.status === 'Vendida' 
                                                                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                                        : vac.status === 'Cancelada'
                                                                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                                                                            : 'bg-blue-50 text-blue-700 border-blue-200'
                                                            }`}>
                                                                {vac.status === 'Gozada' ? 'Gozada (Tirada)' : vac.status === 'Vendida' ? 'Vendida (Abono)' : vac.status}
                                                            </span>
                                                        </td>
                                                        <td className="p-3 text-center">
                                                            {!readOnly && <button onClick={() => handleDeleteVacation(vac.id)} className="text-red-400 hover:text-red-600"><TrashIcon className="h-4 w-4" /></button>}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            {vacations.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-slate-400">Nenhuma férias registrada.</td></tr>}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Resumo de Saldos por Período */}
                                {vacations.length > 0 && (
                                    <div className="mt-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
                                        <h4 className="font-bold text-slate-700 text-sm mb-3 uppercase tracking-wider">Saldo por Período Aquisitivo (Base: 30 dias)</h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {Object.entries(
                                                vacations.reduce((acc, vac) => {
                                                    const p = vac.period || 'Sem Período';
                                                    if (!acc[p]) acc[p] = { gozados: 0, agendados: 0, vendidos: 0 };
                                                    const days = getDurationDays(vac.startDate, vac.endDate);
                                                    if (!isNaN(days) && vac.status !== 'Cancelada') {
                                                        if (vac.status === 'Gozada') {
                                                            acc[p].gozados += days;
                                                        } else if (vac.status === 'Vendida') {
                                                            acc[p].vendidos += days;
                                                        } else {
                                                            acc[p].agendados += days;
                                                        }
                                                    }
                                                    return acc;
                                                }, {} as Record<string, { gozados: number; agendados: number; vendidos: number }>)
                                            ).map(([period, stats]) => {
                                                const totalUsed = stats.gozados + stats.agendados + stats.vendidos;
                                                const balance = 30 - totalUsed;
                                                
                                                // Cálculos de alerta de vencimento
                                                const deadline = getPeriodDeadline(employee.admissionDate, period);
                                                const now = new Date();
                                                let deadlineAlert = null;
                                                
                                                if (deadline && balance > 0) {
                                                    const diffTime = deadline.getTime() - now.getTime();
                                                    const daysToDeadline = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                                    if (diffTime < 0) {
                                                        deadlineAlert = { type: 'overdue', label: 'VENCIDAS ⚠️' };
                                                    } else if (daysToDeadline <= 90) {
                                                        deadlineAlert = { type: 'warning', label: `Vence em ${daysToDeadline} dias` };
                                                    }
                                                }

                                                return (
                                                    <div key={period} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                                                        <div>
                                                            <div className="flex justify-between items-center mb-2">
                                                                <span className="font-extrabold text-slate-700">Período {period}</span>
                                                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                                                    balance <= 0 ? 'bg-green-100 text-green-700' : balance === 30 ? 'bg-slate-100 text-slate-600' : 'bg-blue-100 text-blue-700'
                                                                }`}>
                                                                    {balance <= 0 ? 'Quitado' : `${balance} dias em haver`}
                                                                </span>
                                                            </div>
                                                            {deadlineAlert && (
                                                                <div className="mb-2">
                                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                                                                        deadlineAlert.type === 'overdue' ? 'bg-red-100 text-red-700 animate-pulse' : 'bg-amber-100 text-amber-700'
                                                                    }`}>
                                                                        {deadlineAlert.label}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            <div className="text-xs text-slate-500 space-y-1">
                                                                <div className="flex justify-between"><span>Gozados (Tirados):</span> <span className="font-semibold text-slate-700">{stats.gozados} dias</span></div>
                                                                <div className="flex justify-between"><span>Agendados:</span> <span className="font-semibold text-slate-700">{stats.agendados} dias</span></div>
                                                                <div className="flex justify-between"><span>Vendidos (Abono):</span> <span className="font-semibold text-slate-700">{stats.vendidos} dias</span></div>
                                                                <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden flex">
                                                                    <div className="bg-emerald-500 h-full" style={{ width: `${(stats.gozados / 30) * 100}%` }} title={`Gozados: ${stats.gozados} dias`}></div>
                                                                    <div className="bg-blue-500 h-full" style={{ width: `${(stats.agendados / 30) * 100}%` }} title={`Agendados: ${stats.agendados} dias`}></div>
                                                                    <div className="bg-amber-500 h-full" style={{ width: `${(stats.vendidos / 30) * 100}%` }} title={`Vendidos: ${stats.vendidos} dias`}></div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Atalhos Rápidos de Ação */}
                                                        {balance > 0 && !readOnly && (
                                                            <div className="mt-4 pt-3 border-t border-dashed border-slate-100 flex gap-2">
                                                                <button
                                                                    onClick={() => {
                                                                        setNewVacation(prev => ({
                                                                            ...prev,
                                                                            period: period,
                                                                            status: 'Agendada'
                                                                        }));
                                                                    }}
                                                                    className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-bold py-1.5 px-2 rounded-lg border border-blue-100 transition text-center"
                                                                >
                                                                    Agendar Restante
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        setNewVacation(prev => ({
                                                                            ...prev,
                                                                            period: period,
                                                                            status: 'Vendida'
                                                                        }));
                                                                    }}
                                                                    className="flex-1 bg-amber-50 hover:bg-amber-100 text-amber-700 text-[10px] font-bold py-1.5 px-2 rounded-lg border border-amber-100 transition text-center"
                                                                >
                                                                    Vender Restante
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'tasks' && (
                        <div className="space-y-6">
                            <h3 className="text-lg font-bold text-slate-800">Pendências e Kaizens Atribuídos</h3>
                            {kaizenTasks.length === 0 ? (
                                <p className="text-slate-500">Nenhuma pendência encontrada para este funcionário.</p>
                            ) : (
                                <div className="grid grid-cols-1 gap-4">
                                    {kaizenTasks.map(task => (
                                        <div key={task.id} className="bg-white p-4 rounded-xl shadow-sm border border-l-4 border-l-orange-500 border-slate-100 flex gap-4">
                                            <div className="flex-1">
                                                <div className="flex justify-between items-start mb-2">
                                                    <h4 className="font-bold text-slate-800">{task.description}</h4>
                                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${task.status === 'Aberto' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>{task.status}</span>
                                                </div>
                                                <p className="text-sm text-slate-500 mb-2">Setor: {task.sector} | Aberto em: {new Date(task.date).toLocaleDateString('pt-BR')}</p>
                                                <div className="bg-yellow-50 p-3 rounded-lg text-sm text-yellow-800 border border-yellow-200">
                                                    <strong>Ação Necessária:</strong> Este problema foi atribuído a você. Por favor, acesse o módulo de Melhoria Contínua para registrar as ações tomadas ou resolver o problema.
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div >
    );
};

// --- STATIC ORG CHART (Fixed Structure) ---
// The hierarchy is hardcoded. Only employees in slots and shift times are editable.

const VLine: React.FC<{ height?: number }> = ({ height = 32 }) => (
    <div className="org-vline" style={{ width: 2, height: height || 32, background: '#000', margin: '0 auto' }} />
);

const BlueLabelBox: React.FC<{ label: string }> = ({ label }) => (
    <div style={{
        background: '#4F81BD', border: '2px solid #2F5496', color: '#fff',
        fontWeight: 900, fontSize: 14, letterSpacing: 2, textTransform: 'uppercase',
        padding: '10px 36px', textAlign: 'center', minWidth: 200, whiteSpace: 'nowrap',
    }}>
        {label}
    </div>
);

interface SlotDef { key: string; title: string; }
interface ShiftCardProps {
    shiftKey: string; defaultTime: string; slots: SlotDef[];
    employees: Employee[]; shiftTimes: Record<string, string>;
    onEditShiftTime: (key: string, cur: string) => void;
    onAddEmployee: (slotKey: string) => void;
    onUnassign: (slotKey: string) => void;
}
const StaticShiftCard: React.FC<ShiftCardProps> = ({
    shiftKey, defaultTime, slots, employees, shiftTimes, onEditShiftTime, onAddEmployee, onUnassign
}) => {
    const display = shiftTimes[shiftKey] || defaultTime;
    return (
        <div style={{ border: '1.5px solid #9ca3af', background: '#fff', minWidth: 220, maxWidth: 280 }}>
            <div
                onClick={() => onEditShiftTime(shiftKey, display)}
                title="Clique para editar horário"
                style={{
                    background: '#f1f5f9', borderBottom: '1px solid #d1d5db', padding: '7px 12px',
                    textAlign: 'center', fontWeight: 900, fontSize: 13, textTransform: 'uppercase',
                    color: '#1e293b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
            >
                {display}
                <PencilIcon className="no-print h-3.5 w-3.5 opacity-50" />
            </div>
            <div style={{ padding: '10px 14px' }}>
                {slots.map(slot => {
                    const occ = employees.find(e => e.orgPositionId === slot.key);
                    return (
                        <div key={slot.key} style={{ marginBottom: 5, display: 'flex', alignItems: 'center', gap: 5 }}>
                            {occ ? (
                                <>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <div style={{ height: 28, width: 28, borderRadius: '50%', background: '#e2e8f0', overflow: 'hidden', border: '1px solid #cbd5e1', flexShrink: 0 }}>
                                            {occ.photoUrl ? (
                                                <img src={occ.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            ) : (
                                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#64748b' }}>
                                                    {occ.name.charAt(0)}
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span 
                                                style={{ fontWeight: 800, fontSize: 12, color: '#0f172a', cursor: 'pointer', textTransform: 'uppercase', lineHeight: 1 }}
                                                title="Clique para desvincular"
                                                onClick={() => onUnassign(slot.key)}
                                            >{occ.name.toUpperCase()}</span>
                                            <span style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{slot.title}</span>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <span style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>???? ( {slot.title} )</span>
                                    <button
                                        onClick={() => onAddEmployee(slot.key)}
                                        className="no-print"
                                        style={{ background: '#dbeafe', border: 'none', borderRadius: 4, padding: '2px 7px', fontSize: 13, color: '#2563eb', cursor: 'pointer', fontWeight: 700, marginLeft: 4 }}
                                    >+</button>
                                </>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// Static shift definitions — keys are stable, stored as orgPositionId in DB
const SHIFTS = {
    adm1:       { key: 'adm_t1',     def: 'TURNO 2:00 AS 11:34', slots: [{ key: 'adm_t1_enc', title: 'encarregado' }] },
    adm2:       { key: 'adm_t2',     def: 'TURNO 5:00 AS 14:44', slots: [{ key: 'adm_t2_ges', title: 'gestor qualidade' }] },
    tr1_t1:     { key: 'tr1_t1',     def: 'TURNO 7:45 AS 17:30', slots: [{ key: 'tr1_t1_op', title: 'operador' }, { key: 'tr1_t1_a1', title: 'Auxiliar' }, { key: 'tr1_t1_a2', title: 'Auxiliar' }] },
    tc1_t1:     { key: 'tc1_t1',     def: 'TURNO 5:00 AS 14:44', slots: [{ key: 'tc1_t1_op', title: 'operador' }, { key: 'tc1_t1_a1', title: 'Auxiliar' }] },
    tc1_t2:     { key: 'tc1_t2',     def: 'TURNO 2:00 AS 11:34', slots: [{ key: 'tc1_t2_op', title: 'operador' }, { key: 'tc1_t2_a1', title: 'Auxiliar' }] },
    tc2_t1:     { key: 'tc2_t1',     def: 'TURNO 5:00 AS 14:44', slots: [{ key: 'tc2_t1_op', title: 'operador' }, { key: 'tc2_t1_a1', title: 'Auxiliar' }] },
    tc2_t2:     { key: 'tc2_t2',     def: 'TURNO 2:00 AS 11:34', slots: [{ key: 'tc2_t2_op', title: 'operador' }, { key: 'tc2_t2_a1', title: 'Auxiliar' }] },
    malha_t1:   { key: 'malha_t1',   def: 'TURNO 7:45 AS 17:30', slots: [{ key: 'malha_t1_op', title: 'operador' }, { key: 'malha_t1_a1', title: 'Auxiliar' }, { key: 'malha_t1_a2', title: 'Auxiliar' }] },
};

const OrgChart: React.FC<{
    employees: Employee[];
    units: OrgUnit[];
    positions: OrgPosition[];
    reloadData: () => void;
    triggerAddEmployee: (posId?: string, prefillSector?: string) => void;
    triggerEditEmployee: (emp: Employee) => void;
    evaluations: Evaluation[];
}> = ({ employees, units, positions, reloadData, triggerAddEmployee, triggerEditEmployee }) => {

    const [shiftTimes, setShiftTimes] = useState<Record<string, string>>(() => {
        try { const s = localStorage.getItem('orgShiftTimes'); return s ? JSON.parse(s) : {}; } catch { return {}; }
    });

    // Stats calculation
    const totalSlots = useMemo(() => {
        return Object.values(SHIFTS).reduce((acc, s) => acc + s.slots.length, 0);
    }, []);

    const assignedCount = useMemo(() => {
        const slotKeys = Object.values(SHIFTS).flatMap(s => s.slots.map(sl => sl.key));
        return employees.filter(e => e.orgPositionId && slotKeys.includes(e.orgPositionId)).length;
    }, [employees]);

    const vacanciesCount = totalSlots - assignedCount;

    const handlePrint = () => {
        window.print();
    };

    const handleEditShiftTime = (key: string, cur: string) => {
        const v = prompt('Editar horário (ex: TURNO 7:45 AS 17:30):', cur);
        if (v && v !== cur) {
            const next = { ...shiftTimes, [key]: v };
            setShiftTimes(next);
            localStorage.setItem('orgShiftTimes', JSON.stringify(next));
        }
    };

    // Added state for the NEW selection UI
    const [selectingFor, setSelectingFor] = useState<{ slotKey: string, title: string, sector: string } | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isUpdating, setIsUpdating] = useState(false);

    // Self-healing: Ensure hardcoded IDs exist in DB to satisfy Foreign Key constraints
    useEffect(() => {
        let isSyncing = false;
        const syncDB = async () => {
            if (isSyncing || units.length === 0) return;
            isSyncing = true;
            try {
                // Find or create a base unit for static positions
                let unitId = units[0]?.id;
                
                // Collect required IDs
                const requiredIds: string[] = [];
                Object.values(SHIFTS).forEach(s => s.slots.forEach(sl => requiredIds.push(sl.key)));

                const missing = requiredIds.filter(id => !positions.find(p => p.id === id));
                if (missing.length > 0) {
                    console.log('Syncing missing positions:', missing);
                    for (const id of missing) {
                        try {
                            await insertItem<OrgPosition>('org_positions', {
                                id: id,
                                orgUnitId: unitId,
                                title: 'Slot'
                            });
                        } catch (e) {}
                    }
                    reloadData();
                }
            } catch (err) {} finally { isSyncing = false; }
        };
        syncDB();
    }, [positions.length, units.length]); // Only re-run if lengths change


    const handleUnassign = async (slotKey: string) => {
        if (!confirm('Desvincular este funcionário do cargo?')) return;
        const occ = employees.find(e => e.orgPositionId === slotKey);
        if (occ) await updateItem('employees', occ.id, { orgPositionId: null });
        reloadData();
    };

    const handleAddEmployee = (slotKey: string, title: string, sector: string) => {
        setSelectingFor({ slotKey, title, sector });
        setSearchTerm('');
    };

    const confirmAssignment = async (employeeId: string) => {
        if (!selectingFor || isUpdating) return;
        setIsUpdating(true);
        console.log('Confirming assignment for:', employeeId, selectingFor);
        
        try {
            const { slotKey, title, sector } = selectingFor;

            // 1. Desvincular quem estava antes no slot alvo (se houver)
            const occupants = employees.filter(e => e.orgPositionId === slotKey);
            for (const occ of occupants) {
                console.log('Clearing previous occupant:', occ.name);
                await updateItem('employees', occ.id, { orgPositionId: null });
            }

            // 2. Vincular o novo funcionário e sincronizar cargo/setor
            console.log('Updating employee:', employeeId, 'to', title, sector);
            const result = await updateItem('employees', employeeId, { 
                orgPositionId: slotKey,
                jobTitle: title,
                sector: sector
            });
            console.log('Update result:', result);

            setSelectingFor(null);
            reloadData();
        } catch (error: any) {
            console.error('Error assigning employee:', error);
            alert(`Falha ao vincular funcionário: ${error.message || 'Erro desconhecido'}. Verifique sua conexão ou permissões.`);
        } finally {
            setIsUpdating(false);
        }
    };

    const card = (s: any, sector: string) => (
        <StaticShiftCard
            key={s.key}
            shiftKey={s.key} defaultTime={s.def} slots={s.slots}
            employees={employees} shiftTimes={shiftTimes}
            onEditShiftTime={handleEditShiftTime}
            onAddEmployee={(slotKey) => handleAddEmployee(slotKey, s.slots.find(x => x.key === slotKey)?.title || '', sector)}
            onUnassign={handleUnassign}
        />
    );

    const col: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center' };

    return (
        <div className="org-scroll-wrapper" style={{ overflow: 'auto', padding: 40, background: '#f8fafc', minHeight: 600 }}>
            
            <style>{`
                @media print {
                    .no-print { display: none !important; }
                    html, body { background: white !important; padding: 0 !important; margin: 0 !important; }
                    .print-header { display: flex !important; margin-bottom: 20px; border-bottom: 2px solid #0F3F5C; padding: 10px 0; width: 100%; }
                    .org-container { 
                        display: flex !important;
                        padding: 0 !important; 
                        background: white !important; 
                        width: 100% !important;
                    }
                    .stats-container { margin-bottom: 15px !important; }
                    .org-scroll-wrapper { overflow: visible !important; width: 100% !important; height: auto !important; padding: 10mm !important; }
                    @page { size: landscape; margin: 1cm; }
                    * { 
                        -webkit-print-color-adjust: exact !important; 
                        print-color-adjust: exact !important; 
                        box-shadow: none !important; 
                    }
                }
                .print-header { display: none; }
            `}</style>
            
            <div className="print-header flex items-center justify-between w-full relative">
                <div style={{ fontSize: 18, fontWeight: 900, color: '#64748b', opacity: 0.4 }}>
                    <span style={{ color: '#94a3b8' }}>MSM</span> GESTÃO
                </div>
                <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', textAlign: 'center' }}>
                    <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0F3F5C', textTransform: 'uppercase', letterSpacing: 1 }}>Organograma do setor - LAMINAÇÃO</h2>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{new Date().toLocaleDateString('pt-BR')}</p>
                </div>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-start mb-10 gap-6">
                <div className="flex gap-4 stats-container">
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 min-w-[180px]">
                        <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-1">Colaboradores</p>
                        <p className="text-3xl font-black text-[#0F3F5C]">{assignedCount}</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 min-w-[180px]">
                        <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-1">Vagas Disponíveis</p>
                        <p className="text-3xl font-black text-blue-600">{vacanciesCount}</p>
                    </div>
                </div>

                <button 
                    onClick={handlePrint}
                    className="no-print bg-[#0F3F5C] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#1a5f8a] transition shadow-lg flex items-center gap-2"
                >
                    <PrinterIcon className="h-5 w-5" />
                    Imprimir Organograma
                </button>
            </div>

            <div className="org-container" style={col}>

                <BlueLabelBox label="SETOR LAMINAÇÃO" />
                <VLine />
                <BlueLabelBox label="ADMINISTRAÇÃO" />
                <VLine />
                {card(SHIFTS.adm1, 'ADMINISTRAÇÃO')}
                <VLine />
                {card(SHIFTS.adm2, 'ADMINISTRAÇÃO')}
                <VLine />
                <BlueLabelBox label="MÁQUINAS" />
                <VLine />

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: 48, alignItems: 'flex-start' }}>

                        <div style={col}>
                            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                                <div className="org-hline" style={{ position: 'absolute', top: 0, left: '50%', right: -24, height: 2, background: '#000' }} />
                                <div className="org-vline" style={{ width: 2, height: 24, background: '#000', zIndex: 1 }} />
                            </div>
                            <BlueLabelBox label="TREFILA 1" />
                            <VLine />
                            {card(SHIFTS.tr1_t1, 'TREFILA 1')}
                        </div>

                        <div style={col}>
                            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                                <div className="org-hline" style={{ position: 'absolute', top: 0, left: -24, right: -24, height: 2, background: '#000' }} />
                                <div className="org-vline" style={{ width: 2, height: 24, background: '#000', zIndex: 1 }} />
                            </div>
                            <BlueLabelBox label="TRELIÇA 1" />
                            <VLine />
                            {card(SHIFTS.tc1_t1, 'TRELIÇA 1')}
                            <VLine />
                            {card(SHIFTS.tc1_t2, 'TRELIÇA 1')}
                        </div>

                        {/* TRELIÇA 2 — middle column: line extends 24px on both sides */}
                        <div style={col}>
                            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                                <div className="org-hline" style={{ position: 'absolute', top: 0, left: -24, right: -24, height: 2, background: '#000' }} />
                                <div className="org-vline" style={{ width: 2, height: 24, background: '#000', zIndex: 1 }} />
                            </div>
                            <BlueLabelBox label="TRELIÇA 2" />
                            <VLine />
                            {card(SHIFTS.tc2_t1, 'TRELIÇA 2')}
                            <VLine />
                            {card(SHIFTS.tc2_t2, 'TRELIÇA 2')}
                        </div>

                        {/* MALHA — last column: line extends left into gap */}
                        <div style={col}>
                            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                                {/* Horizontal: from left (extends 24px past column edge) → center */}
                                <div className="org-hline" style={{ position: 'absolute', top: 0, left: -24, right: '50%', height: 2, background: '#000' }} />
                                <div className="org-vline" style={{ width: 2, height: 24, background: '#000', zIndex: 1 }} />
                            </div>
                            <BlueLabelBox label="MALHA" />
                            <VLine />
                            {card(SHIFTS.malha_t1, 'MALHA')}
                        </div>

                    </div>
                </div>

            {/* Employee Selection Overlay */}
            {selectingFor && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[80vh]">
                        <div className="p-6 border-b flex justify-between items-center bg-slate-50 rounded-t-2xl">
                            <div className="flex-1">
                                <h3 className="font-bold text-slate-800 text-lg">Vincular Colaborador</h3>
                                <p className="text-xs text-slate-500 uppercase font-black tracking-tight mt-1">
                                    {selectingFor.sector} — <span className="text-blue-600">{selectingFor.title}</span>
                                </p>
                            </div>
                            <button onClick={() => setSelectingFor(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                                <XIcon className="h-6 w-6 text-slate-400" />
                            </button>
                        </div>
                        
                        <div className="p-4 bg-white sticky top-0 z-10">
                            <div className="relative">
                                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                <input 
                                    type="text" 
                                    placeholder="Buscar por nome..." 
                                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    autoFocus
                                />
                            </div>
                        </div>
                        
                        <div className="flex-1 overflow-auto p-3 space-y-1">
                            {employees
                                .filter(e => e.active) // Only active
                                .filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase()))
                                .length > 0 ? (
                                    employees
                                        .filter(e => e.active)
                                        .filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase()))
                                        .sort((a,b) => a.name.localeCompare(b.name))
                                        .map(e => {
                                            const isCurrentlyAssigned = !!e.orgPositionId;
                                            return (
                                                <button 
                                                    key={e.id}
                                                    disabled={isUpdating}
                                                    onClick={async () => {
                                                        if (isCurrentlyAssigned && !confirm(`${e.name} já possui um cargo. Deseja movê-lo para esta nova posição?`)) return;
                                                        await confirmAssignment(e.id);
                                                    }}
                                                    className={`w-full text-left p-3 hover:bg-blue-50 rounded-xl flex items-center gap-4 group transition-all border border-transparent hover:border-blue-100 ${isUpdating ? 'opacity-50 cursor-wait' : ''}`}
                                                >
                                                    <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold group-hover:bg-blue-100 group-hover:text-blue-600 overflow-hidden shrink-0 border border-slate-200">
                                                        {e.photoUrl ? <img src={e.photoUrl} className="h-full w-full object-cover" /> : e.name.charAt(0)}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-bold text-slate-800 group-hover:text-blue-800 truncate">{e.name}</p>
                                                        <p className="text-[10px] text-slate-500 uppercase font-medium">
                                                            {isCurrentlyAssigned ? `${e.jobTitle} • ${e.sector}` : 'Disponível / Sem Cargo'}
                                                        </p>
                                                    </div>
                                                    {isCurrentlyAssigned && (
                                                        <div className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded font-bold uppercase group-hover:bg-blue-200 group-hover:text-blue-700">Mover</div>
                                                    )}
                                                </button>
                                            );
                                        })
                                ) : (
                                    <div className="text-center py-12 px-6">
                                        <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <SearchIcon className="h-10 w-10 text-slate-200" />
                                        </div>
                                        <p className="text-slate-400 font-medium">Nenhum colaborador encontrado com "{searchTerm}"</p>
                                        <button 
                                            onClick={() => { setSelectingFor(null); triggerAddEmployee(selectingFor.slotKey, selectingFor.sector); }}
                                            className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition"
                                        >
                                            + Cadastrar Novo
                                        </button>
                                    </div>
                                )
                            }
                        </div>
                        <div className="p-4 bg-slate-50 border-t rounded-b-2xl text-[10px] text-center text-slate-400 uppercase font-black tracking-widest">
                            Lista de Colaboradores MSM
                        </div>
                    </div>
                </div>
            )}
        </div>
    </div>
    );
};





const EmployeeSelfDashboard: React.FC<{ employee: Employee, onOpenModal: (tab: string) => void }> = ({ employee, onOpenModal }) => {
    const [pendingTasksCount, setPendingTasksCount] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkTasks = async () => {
            try {
                const allProblems = await fetchTable<KaizenProblem>('kaizen_problems');
                const myTasks = allProblems.filter(p => {
                    const isResponsibleId = p.responsibleIds?.includes(employee.id);
                    const isResponsibleName = p.responsible && p.responsible.includes(employee.name);
                    return (isResponsibleId || isResponsibleName) && p.status !== 'Resolvido';
                });
                setPendingTasksCount(myTasks.length);
            } catch (e) {
                console.error('Error fetching dashboard tasks', e);
            } finally {
                setLoading(false);
            }
        };
        checkTasks();
    }, [employee.id]);

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            {/* Welcome Header */}
            <div className="bg-gradient-to-r from-[#0F3F5C] to-[#1a5f8a] rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 opacity-10 transform translate-x-10 -translate-y-10">
                    <UserIcon className="h-64 w-64" />
                </div>
                <div className="relative z-10 flex flex-col md:flex-row items-center gap-6">
                    <div className="h-24 w-24 rounded-full border-4 border-white/30 shadow-lg overflow-hidden bg-white/10 shrink-0">
                        {employee.photoUrl ? <img src={employee.photoUrl} className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center text-3xl font-bold"> {employee.name.charAt(0)} </span>}
                    </div>
                    <div className="text-center md:text-left">
                        <h2 className="text-3xl font-bold mb-1">Olá, {employee.name.split(' ')[0]}!</h2>
                        <p className="text-blue-100 text-lg opacity-90">Bem-vindo ao seu Portal do Colaborador.</p>
                        <p className="text-sm text-blue-200 mt-2 font-mono uppercase tracking-widest">{employee.jobTitle || 'Colaborador'} • {employee.sector}</p>
                    </div>
                </div>
            </div>

            {/* Pending Tasks Alert */}
            {pendingTasksCount > 0 && (
                <div onClick={() => onOpenModal('tasks')} className="bg-orange-50 border-l-8 border-orange-500 rounded-xl p-6 shadow-sm cursor-pointer hover:shadow-md hover:translate-x-1 transition-all group">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="bg-orange-100 p-3 rounded-full text-orange-600 group-hover:bg-orange-200 transition">
                                <ExclamationIcon className="h-8 w-8" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-800 group-hover:text-orange-700 transition">Atenção Necessária</h3>
                                <p className="text-slate-600">Você possui <strong className="text-orange-600">{pendingTasksCount} pendência(s)</strong> ou ações do Kaizen atribuídas a você.</p>
                            </div>
                        </div>
                        <div className="hidden md:flex items-center text-orange-600 font-bold text-sm gap-1 group-hover:gap-2 transition-all">
                            Ver Pendências <ArrowLeftIcon className="h-4 w-4 rotate-180" />
                        </div>
                    </div>
                </div>
            )}

            {/* Quick Access Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <button onClick={() => onOpenModal('profile')} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-lg hover:-translate-y-1 transition-all group text-left">
                    <div className="bg-blue-50 w-12 h-12 rounded-xl flex items-center justify-center text-[#0F3F5C] mb-4 group-hover:scale-110 transition-transform">
                        <UserIcon className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mb-2">Meus Dados</h3>
                    <p className="text-slate-500 text-sm">Visualize e matenha seus dados cadastrais atualizados.</p>
                </button>

                <button onClick={() => onOpenModal('documents')} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-lg hover:-translate-y-1 transition-all group text-left">
                    <div className="bg-purple-50 w-12 h-12 rounded-xl flex items-center justify-center text-purple-600 mb-4 group-hover:scale-110 transition-transform">
                        <DocumentTextIcon className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mb-2">Meus Documentos</h3>
                    <p className="text-slate-500 text-sm">Acesse seus comprovantes, holerites e certificados.</p>
                </button>

                <button onClick={() => onOpenModal('evaluations')} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-lg hover:-translate-y-1 transition-all group text-left">
                    <div className="bg-yellow-50 w-12 h-12 rounded-xl flex items-center justify-center text-yellow-600 mb-4 group-hover:scale-110 transition-transform">
                        <StarIcon className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mb-2">Minhas Avaliações</h3>
                    <p className="text-slate-500 text-sm">Acompanhe seu desempenho e feedbacks recebidos.</p>
                </button>
            </div>

            {/* Info Footer */}
            <div className="text-center text-slate-400 text-sm pt-8">
                <p>Mantenha seus dados sempre atualizados para facilitar a comunicação.</p>
            </div>
        </div>
    );
};

const PeopleManagement: React.FC<PeopleManagementProps> = ({ setPage, currentUser }) => {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
    const [absences, setAbsences] = useState<EmployeeAbsence[]>([]);
    const [vacations, setVacations] = useState<EmployeeVacation[]>([]);
    const [selectedEmployee, setSelectedEmployee] = useState<{ emp: Employee, tab?: any } | null>(null);
    const [viewMode, setViewMode] = useState<'dashboard' | 'cards' | 'orgChart'>('dashboard');
    const [orgUnits, setOrgUnits] = useState<OrgUnit[]>([]);
    const [orgPositions, setOrgPositions] = useState<OrgPosition[]>([]);

    // Employee Form State (Simplified for direct creation)
    const [newEmployeeName, setNewEmployeeName] = useState('');

    const isRestrictedUser = useMemo(() => currentUser?.role === 'user' && !!currentUser?.employeeId, [currentUser]);

    const loadData = async () => {
        let emp = await fetchTable<Employee>('employees');
        let evals = await fetchTable<Evaluation>('evaluations');
        let abs = await fetchTable<EmployeeAbsence>('employee_absences');
        let vacs = await fetchTable<EmployeeVacation>('employee_vacations');

        if (isRestrictedUser) {
            emp = emp.filter(e => e.id === currentUser!.employeeId);
            evals = evals.filter(ev => ev.employeeId === currentUser!.employeeId);
            abs = abs.filter(a => a.employeeId === currentUser!.employeeId);
            vacs = vacs.filter(v => v.employeeId === currentUser!.employeeId);
        }

        const units = await fetchTable<OrgUnit>('org_units');
        const pos = await fetchTable<OrgPosition>('org_positions');

        setEmployees(emp);
        setEvaluations(evals);
        setAbsences(abs);
        setVacations(vacs);
        setOrgUnits(units);
        setOrgPositions(pos);
    };

    useEffect(() => {
        loadData();
        if (isRestrictedUser) {
            setViewMode('cards'); // We will override the render content for restricted user anyway
        }
    }, [isRestrictedUser]);

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
            setSelectedEmployee({ emp: newEmp });

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
                    employee={selectedEmployee.emp}
                    currentUser={currentUser}
                    onClose={() => setSelectedEmployee(null)}
                    onSave={loadData}
                    onDelete={() => handleDeleteEmployee(selectedEmployee.emp.id)}
                    readOnly={isRestrictedUser}
                    initialTab={selectedEmployee.tab}
                />
            )}

            {/* Simple Add Modal removed, replaced by direct prompt logic */}

            <header className="no-print flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 pt-4">
                <div className="flex items-center justify-between md:justify-start w-full md:w-auto">
                    <div className="flex items-center">
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Gestão de Pessoas</h1>
                            <p className="text-sm md:text-base text-slate-500">Prontuário Digital</p>
                        </div>
                    </div>
                    {/* Mobile Only Add Button */}
                    {!isRestrictedUser && (
                        <button onClick={() => promptAndCreateEmployee()} className="md:hidden bg-[#0F3F5C] text-white p-2 rounded-lg shadow-lg">
                            <PlusIcon className="h-6 w-6" />
                        </button>
                    )}
                </div>

                {!isRestrictedUser && (
                    <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                        <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 shadow-sm overflow-x-auto w-full md:w-auto">
                            <button
                                onClick={() => setViewMode('dashboard')}
                                className={`flex-1 md:flex-none px-4 py-2 rounded-md font-medium text-sm transition whitespace-nowrap ${viewMode === 'dashboard' ? 'bg-slate-100 text-[#0F3F5C] font-bold' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Dashboard
                            </button>
                            <button
                                onClick={() => setViewMode('cards')}
                                className={`flex-1 md:flex-none px-4 py-2 rounded-md font-medium text-sm transition whitespace-nowrap ${viewMode === 'cards' ? 'bg-slate-100 text-[#0F3F5C] font-bold' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Lista
                            </button>
                            <button
                                onClick={() => setViewMode('orgChart')}
                                className={`flex-1 md:flex-none px-4 py-2 rounded-md font-medium text-sm transition whitespace-nowrap ${viewMode === 'orgChart' ? 'bg-slate-100 text-[#0F3F5C] font-bold' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Organograma
                            </button>
                        </div>

                        <button onClick={() => promptAndCreateEmployee()} className="hidden md:flex bg-[#0F3F5C] text-white px-4 py-2 rounded-lg font-bold hover:bg-[#0A2A3D] transition items-center gap-2 whitespace-nowrap">
                            <PlusIcon className="h-5 w-5" />
                            Novo Funcionário
                        </button>
                    </div>
                )}
            </header>

            {viewMode === 'cards' ? (
                <>
                    {/* Employee Dashboard for Restricted Users */}
                    {isRestrictedUser && employees.length > 0 ? (
                        <EmployeeSelfDashboard
                            employee={employees[0]}
                            onOpenModal={(tab) => setSelectedEmployee({ emp: employees[0], tab })}
                        />
                    ) : (
                        <div className="space-y-12">
                            {(Object.entries(
                                employees.reduce((acc, emp) => {
                                    const sector = emp.sector || 'Geral / Outros';
                                    if (!acc[sector]) acc[sector] = [];
                                    acc[sector].push(emp);
                                    return acc;
                                }, {} as Record<string, Employee[]>)
                            ) as [string, Employee[]][]).sort(([a], [b]) => a.localeCompare(b)).map(([sector, sectorEmps]) => (
                                <div key={sector}>
                                    <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-2">
                                        <div className="flex items-center gap-2">
                                            <div className="h-8 w-1 bg-[#0F3F5C] rounded-full"></div>
                                            <h2 className="text-xl font-extrabold text-[#0F3F5C] uppercase tracking-wider">{sector}</h2>
                                            <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full text-xs font-bold">{sectorEmps.length}</span>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {sectorEmps.map(emp => (
                                            <EmployeeCard
                                                key={emp.id}
                                                employee={emp}
                                                evaluations={evaluations}
                                                onSelect={() => setSelectedEmployee({ emp })}
                                                onDelete={() => handleDeleteEmployee(emp.id)}
                                            />
                                        ))}
                                    </div>
                                </div>
                            ))}
                            {employees.length === 0 && (
                                <div className="col-span-full text-center py-20 bg-white rounded-2xl border-2 border-dashed border-slate-200">
                                    <UserGroupIcon className="h-12 w-12 text-slate-200 mx-auto mb-4" />
                                    <p className="text-slate-500 font-medium">Nenhum funcionário cadastrado. Adicione o primeiro!</p>
                                </div>
                            )}
                        </div>
                    )}
                </>
            ) : viewMode === 'orgChart' ? (
                <OrgChart
                    employees={employees}
                    units={orgUnits}
                    positions={orgPositions}
                    evaluations={evaluations}
                    reloadData={loadData}
                    triggerAddEmployee={promptAndCreateEmployee}
                    triggerEditEmployee={(emp) => setSelectedEmployee({ emp })}
                />
            ) : (
                <DashboardRH employees={employees} absences={absences} vacations={vacations} />
            )}
            {selectedEmployee && (
                <EmployeeDetailModal
                    employee={selectedEmployee.emp}
                    currentUser={currentUser}
                    onClose={() => setSelectedEmployee(null)}
                    onSave={loadData}
                    onDelete={() => handleDeleteEmployee(selectedEmployee.emp.id)}
                    readOnly={isRestrictedUser}
                    initialTab={selectedEmployee.tab}
                    orgUnits={orgUnits}
                    orgPositions={orgPositions}
                />
            )}
        </div>
    );
};

export default PeopleManagement;
