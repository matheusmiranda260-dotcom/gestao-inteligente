import { MachineShiftConfig, PcpShiftConfig, PcpHoliday } from '../types';

export const DEFAULT_GLOBAL_SHIFT_CONFIG: PcpShiftConfig = {
    id: 'default',
    workStart: '07:45',
    lunchStart: '12:00',
    lunchEnd: '13:00',
    workEnd: '17:33',
    workDays: [1, 2, 3, 4, 5],
    noLunch: true,
    autoStartShift: false, // Maquinas NUNCA devem ligar ou iniciar turno sozinhas
    autoEndShift: true,
    autoEndTimeoutMin: 5,
    requireManagerAuthForOvertime: true,
};

export const DEFAULT_MACHINE_SHIFTS: Record<string, MachineShiftConfig> = {
    'Trefila': {
        workStart: '07:45',
        workEnd: '17:33',
        noLunch: true,
        shiftCount: 1,
        workDays: [1, 2, 3, 4, 5],
        autoStartShift: false,
        autoEndShift: true,
        autoEndTimeoutMin: 5,
        requireManagerAuthForOvertime: true
    },
    'Trefila 1': {
        workStart: '07:45',
        workEnd: '17:33',
        noLunch: true,
        shiftCount: 1,
        workDays: [1, 2, 3, 4, 5],
        autoStartShift: false,
        autoEndShift: true,
        autoEndTimeoutMin: 5,
        requireManagerAuthForOvertime: true
    },
    'Trefila 2': {
        workStart: '07:45',
        workEnd: '17:33',
        noLunch: true,
        shiftCount: 1,
        workDays: [1, 2, 3, 4, 5],
        autoStartShift: false,
        autoEndShift: true,
        autoEndTimeoutMin: 5,
        requireManagerAuthForOvertime: true
    },
    'Treliça': {
        workStart: '07:45',
        workEnd: '17:33',
        noLunch: true,
        shiftCount: 1,
        workDays: [1, 2, 3, 4, 5],
        autoStartShift: false,
        autoEndShift: true,
        autoEndTimeoutMin: 5,
        requireManagerAuthForOvertime: true
    },
    'Treliça 1': {
        workStart: '07:45',
        workEnd: '17:33',
        noLunch: true,
        shiftCount: 1,
        workDays: [1, 2, 3, 4, 5],
        autoStartShift: false,
        autoEndShift: true,
        autoEndTimeoutMin: 5,
        requireManagerAuthForOvertime: true
    },
    'Treliça 2': {
        workStart: '07:45',
        workEnd: '17:33',
        noLunch: true,
        shiftCount: 1,
        workDays: [1, 2, 3, 4, 5],
        autoStartShift: false,
        autoEndShift: true,
        autoEndTimeoutMin: 5,
        requireManagerAuthForOvertime: true
    },
    'Malha': {
        workStart: '06:20',
        workEnd: '17:33',
        noLunch: true,
        shiftCount: 1,
        workDays: [1, 2, 3, 4, 5],
        autoStartShift: false,
        autoEndShift: true,
        autoEndTimeoutMin: 5,
        requireManagerAuthForOvertime: true
    },
    'Malha 1': {
        workStart: '06:20',
        workEnd: '17:33',
        noLunch: true,
        shiftCount: 1,
        workDays: [1, 2, 3, 4, 5],
        autoStartShift: false,
        autoEndShift: true,
        autoEndTimeoutMin: 5,
        requireManagerAuthForOvertime: true
    }
};

/**
 * Resgata a configuração efetiva para uma máquina específica.
 * Se a máquina possuir configuração customizada em globalConfig.machineConfigs, usa ela.
 * Caso contrário, mescla default de máquina com os defaults globais.
 */
export const resolveMachineShiftConfig = (
    machineName: string, 
    globalConfig?: PcpShiftConfig | null
): MachineShiftConfig => {
    const rawMachName = (machineName || '').trim();
    const norm = (s: string) => (s || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/^_+/, '').trim();
    const rawNorm = norm(rawMachName);

    // 1. Busca exata ou por prefixo em machineConfigs (suporta nomes com ou sem prefixo '_')
    let custom = globalConfig?.machineConfigs?.[rawMachName];
    if (!custom && rawMachName && globalConfig?.machineConfigs) {
        const matchedKey = Object.keys(globalConfig.machineConfigs).find(k => {
            const kNorm = norm(k);
            return kNorm === rawNorm || kNorm.startsWith(rawNorm) || rawNorm.startsWith(kNorm);
        });
        if (matchedKey) {
            custom = globalConfig.machineConfigs[matchedKey];
        }
    }

    // 2. Busca exata ou por prefixo nos defaults de máquina
    let defaultForMach = DEFAULT_MACHINE_SHIFTS[rawMachName];
    if (!defaultForMach && rawMachName) {
        const matchedDefaultKey = Object.keys(DEFAULT_MACHINE_SHIFTS).find(k => {
            const kNorm = norm(k);
            return kNorm === rawNorm || kNorm.startsWith(rawNorm) || rawNorm.startsWith(kNorm);
        });
        if (matchedDefaultKey) {
            defaultForMach = DEFAULT_MACHINE_SHIFTS[matchedDefaultKey];
        }
    }

    if (custom && custom.workStart && custom.workEnd) {
        const resolvedShiftCount = custom.shiftCount !== undefined 
            ? Number(custom.shiftCount) as (1 | 2) 
            : (defaultForMach?.shiftCount || 1);

        return {
            ...custom,
            workDays: (Array.isArray(custom.workDays) && custom.workDays.length > 0) ? custom.workDays : (globalConfig?.workDays || [1, 2, 3, 4, 5]),
            autoStartShift: custom.autoStartShift === true, // Apenas se explicitamente true
            autoEndShift: custom.autoEndShift !== undefined ? Boolean(custom.autoEndShift) : (globalConfig?.autoEndShift !== false),
            autoEndTimeoutMin: Number(custom.autoEndTimeoutMin) || Number(globalConfig?.autoEndTimeoutMin) || 5,
            requireManagerAuthForOvertime: custom.requireManagerAuthForOvertime !== undefined ? Boolean(custom.requireManagerAuthForOvertime) : (globalConfig?.requireManagerAuthForOvertime !== false),
            shiftCount: resolvedShiftCount,
            shift2Start: resolvedShiftCount === 2 ? (custom.shift2Start || defaultForMach?.shift2Start || '14:48') : undefined,
            shift2End: resolvedShiftCount === 2 ? (custom.shift2End || defaultForMach?.shift2End || '23:36') : undefined,
        };
    }

    // Default específico por máquina
    if (defaultForMach) {
        return { 
            ...defaultForMach,
            autoStartShift: false
        };
    }

    // Fallback para o globalConfig ou default da fábrica
    return {
        workStart: globalConfig?.workStart || '07:45',
        workEnd: globalConfig?.workEnd || '17:33',
        noLunch: globalConfig?.noLunch ?? true,
        lunchStart: globalConfig?.lunchStart || '12:00',
        lunchEnd: globalConfig?.lunchEnd || '13:00',
        workDays: globalConfig?.workDays || [1, 2, 3, 4, 5],
        shiftCount: 1,
        autoStartShift: false,
        autoEndShift: globalConfig?.autoEndShift !== false,
        autoEndTimeoutMin: globalConfig?.autoEndTimeoutMin || 5,
        requireManagerAuthForOvertime: globalConfig?.requireManagerAuthForOvertime !== false
    };
};

export interface MachineShiftEvaluation {
    inShiftWindow: boolean;
    isEarlyStart: boolean;
    isHoliday?: boolean;
    holidayName?: string;
    isOvertime: boolean;
    isAutoEndCountdown: boolean;
    remainingCountdownSeconds: number;
    shiftName: string;
    shiftLabel: string;
    workStart: string;
    workEnd: string;
    shiftStartMs: number;
    shiftEndMs: number;
    autoStartShift: boolean;
    autoEndShift: boolean;
    autoEndTimeoutMin: number;
    requireManagerAuthForOvertime: boolean;
    progressPercent: number;
    statusText: string;
    isWorkDay: boolean;
}

export const getCachedPcpHolidays = (): { date: string; description?: string }[] => {
    try {
        if (typeof localStorage !== 'undefined') {
            const raw = localStorage.getItem('pcp_holidays');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    return parsed
                        .map((h: any) => typeof h === 'string' ? { date: h } : { date: h.date, description: h.description })
                        .filter(h => Boolean(h.date));
                }
            }
        }
    } catch (_) {}
    return [];
};

const parseHourMin = (timeStr: any) => {
    if (!timeStr || typeof timeStr !== 'string' || !timeStr.includes(':')) return { h: 7, m: 45 };
    const parts = timeStr.split(':');
    return { h: parseInt(parts[0], 10) || 0, m: parseInt(parts[1], 10) || 0 };
};

/**
 * Extrai componentes de data e hora garantindo fuso oficial de Brasília (America/Sao_Paulo).
 * Isso impede que dispositivos com relógio em UTC derrubem turnos horas antes do expediente.
 */
export const getBrasiliaDateInfo = (refDate: Date = new Date()) => {
    try {
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/Sao_Paulo',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
        const parts = formatter.formatToParts(refDate);
        const map: Record<string, string> = {};
        for (const p of parts) map[p.type] = p.value;
        const year = parseInt(map.year, 10);
        const month = parseInt(map.month, 10);
        const day = parseInt(map.day, 10);
        let hour = parseInt(map.hour, 10);
        if (hour === 24) hour = 0;
        const minute = parseInt(map.minute, 10);
        const second = parseInt(map.second, 10);
        const localSpDate = new Date(year, month - 1, day, hour, minute, second);
        const dayOfWeek = localSpDate.getDay();
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return { year, month, day, hour, minute, second, dayOfWeek, dateStr, localSpDate };
    } catch (_) {
        const y = refDate.getFullYear();
        const m = refDate.getMonth() + 1;
        const d = refDate.getDate();
        return {
            year: y,
            month: m,
            day: d,
            hour: refDate.getHours(),
            minute: refDate.getMinutes(),
            second: refDate.getSeconds(),
            dayOfWeek: refDate.getDay(),
            dateStr: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
            localSpDate: refDate
        };
    }
};

/**
 * Avalia em tempo real a situação do turno para uma máquina, considerando dias úteis, horários e feriados cadastrados.
 */
export const checkMachineShiftStatus = (
    machineName: string,
    globalConfig?: PcpShiftConfig | null,
    refDate: Date = new Date(),
    holidaysList?: (PcpHoliday | string)[]
): MachineShiftEvaluation => {
    const config = resolveMachineShiftConfig(machineName, globalConfig);

    // Obter data e hora locais no fuso oficial de Brasília
    const brDate = getBrasiliaDateInfo(refDate);
    const todayDateStr = brDate.dateStr;

    // Resolver feriados disponíveis (parâmetro direto > embutido em globalConfig > cache no localStorage)
    let allHolidays: { date: string; description?: string }[] = [];
    if (Array.isArray(holidaysList) && holidaysList.length > 0) {
        allHolidays = holidaysList.map(h => typeof h === 'string' ? { date: h } : { date: h.date, description: h.description });
    } else if (Array.isArray(globalConfig?.holidays) && globalConfig.holidays.length > 0) {
        allHolidays = globalConfig.holidays.map(h => typeof h === 'string' ? { date: h } : { date: h.date, description: h.description });
    } else {
        allHolidays = getCachedPcpHolidays();
    }

    const matchedHoliday = allHolidays.find(h => h.date === todayDateStr);
    const isHoliday = Boolean(matchedHoliday);
    const holidayName = matchedHoliday?.description || '';

    const dayOfWeek = brDate.dayOfWeek; // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
    const workDays = config.workDays || [1, 2, 3, 4, 5];
    const isRegularWorkDay = workDays.includes(dayOfWeek);

    const currentH = brDate.hour;
    const currentM = brDate.minute;
    const currentVal = currentH + currentM / 60;

    let activeShiftName = config.shiftCount === 1 ? '1º Turno (Único)' : 'Turno Padrão';
    let sStartStr = config.workStart || '07:45';
    let sEndStr = config.workEnd || '17:33';

    if (config.shiftCount === 2 && config.shift2Start && config.shift2End) {
        const s1 = parseHourMin(config.workStart);
        const s2 = parseHourMin(config.shift2Start);
        const s1Val = s1.h + s1.m / 60;
        const s2Val = s2.h + s2.m / 60;

        // Se estamos dentro ou logo antes do Turno 1
        if (currentVal >= (s1Val - 1) && currentVal < s2Val) {
            activeShiftName = 'Turno A';
            sStartStr = config.workStart;
            sEndStr = config.workEnd;
        } else {
            activeShiftName = 'Turno B';
            sStartStr = config.shift2Start;
            sEndStr = config.shift2End;
        }
    }

    const { h: startH, m: startM } = parseHourMin(sStartStr);
    const { h: endH, m: endM } = parseHourMin(sEndStr);

    const shiftStart = new Date(brDate.localSpDate);
    shiftStart.setHours(startH, startM, 0, 0);

    const shiftEnd = new Date(brDate.localSpDate);
    shiftEnd.setHours(endH, endM, 0, 0);

    // Tratamento para turnos noturnos que viram a meia-noite
    if (endH < startH) {
        if (currentH <= endH) {
            shiftStart.setDate(shiftStart.getDate() - 1);
        } else {
            shiftEnd.setDate(shiftEnd.getDate() + 1);
        }
    }

    const nowMs = brDate.localSpDate.getTime();
    const startMs = shiftStart.getTime();
    const endMs = shiftEnd.getTime();
    const autoEndTimeoutMin = config.autoEndTimeoutMin || 5;
    const autoTimeoutMs = autoEndTimeoutMin * 60 * 1000;

    // Se HOJE for FERIADO cadastrado (ex: Nossa Senhora Aparecida 12/10)
    if (isHoliday) {
        const fDesc = holidayName || 'Feriado / Folga';
        return {
            inShiftWindow: false,
            isEarlyStart: false,
            isHoliday: true,
            holidayName: fDesc,
            isOvertime: true,
            isAutoEndCountdown: false,
            remainingCountdownSeconds: 0,
            shiftName: `${fDesc} (Feriado)`,
            shiftLabel: 'Feriado / Folga Oficial',
            workStart: sStartStr,
            workEnd: sEndStr,
            shiftStartMs: startMs,
            shiftEndMs: endMs,
            autoStartShift: false,
            autoEndShift: false, // Não auto-encerrar compulsivamente se houver operador trabalhando no feriado
            autoEndTimeoutMin,
            requireManagerAuthForOvertime: config.requireManagerAuthForOvertime !== false,
            progressPercent: 0,
            statusText: fDesc,
            isWorkDay: false
        };
    }

    // Se HOJE NÃO for dia de trabalho programado da máquina (ex: Sábado ou Domingo)
    if (!isRegularWorkDay) {
        return {
            inShiftWindow: false,
            isEarlyStart: false,
            isHoliday: false,
            holidayName: '',
            isOvertime: true,
            isAutoEndCountdown: false,
            remainingCountdownSeconds: 0,
            shiftName: 'Fim de Semana / Folga',
            shiftLabel: 'Sem Expediente Programado',
            workStart: sStartStr,
            workEnd: sEndStr,
            shiftStartMs: startMs,
            shiftEndMs: endMs,
            autoStartShift: false,
            autoEndShift: false, // Não auto-encerrar compulsivamente em fim de semana com produção ativa
            autoEndTimeoutMin,
            requireManagerAuthForOvertime: config.requireManagerAuthForOvertime !== false,
            progressPercent: 0,
            statusText: 'Folga / Fim de Semana',
            isWorkDay: false
        };
    }

    // Tolerância de 10 min de antecedência para iniciar turno
    const earlyToleranceMs = 10 * 60 * 1000;
    const isWithinHours = nowMs >= (startMs - earlyToleranceMs) && nowMs <= endMs;
    const inShiftWindow = isWithinHours;

    // Início antes do horário permitido (ex: chegou às 06:00 ou 07:00 quando o turno inicia às 07:45)
    const isEarlyStart = nowMs < (startMs - earlyToleranceMs);

    // Hora extra ocorre estritamente APÓS o horário final de expediente programado
    let isOvertime = false;
    let isAutoEndCountdown = false;
    let remainingCountdownSeconds = 0;

    // Se passou do horário de encerramento do turno
    if (nowMs > endMs) {
        isOvertime = true;
        const elapsedSinceEnd = nowMs - endMs;
        if (elapsedSinceEnd < autoTimeoutMs) {
            isAutoEndCountdown = true;
            remainingCountdownSeconds = Math.max(0, Math.ceil((autoTimeoutMs - elapsedSinceEnd) / 1000));
        }
    }

    const totalShiftDuration = Math.max(1, endMs - startMs);
    let progressPercent = 0;
    let statusText = '';

    if (nowMs < startMs) {
        progressPercent = 0;
        const diffMs = startMs - nowMs;
        const diffMin = Math.ceil(diffMs / 60000);
        statusText = `Inicia em ${diffMin} min`;
    } else if (nowMs <= endMs) {
        progressPercent = Math.min(100, Math.max(0, ((nowMs - startMs) / totalShiftDuration) * 100));
        const remMs = endMs - nowMs;
        const remH = Math.floor(remMs / 3600000);
        const remM = Math.floor((remMs % 3600000) / 60000);
        statusText = remH > 0 ? `Restam ${remH}h ${remM}m` : `Restam ${remM} min`;
    } else {
        progressPercent = 100;
        const extraMs = nowMs - endMs;
        const extraH = Math.floor(extraMs / 3600000);
        const extraM = Math.floor((extraMs % 3600000) / 60000);
        statusText = extraH > 0 ? `+${extraH}h ${extraM}m (Extra)` : `+${extraM} min (Extra)`;
    }

    return {
        inShiftWindow,
        isEarlyStart,
        isHoliday: false,
        holidayName: '',
        isOvertime,
        isAutoEndCountdown,
        remainingCountdownSeconds,
        shiftName: activeShiftName,
        shiftLabel: `${sStartStr} - ${sEndStr}`,
        workStart: sStartStr,
        workEnd: sEndStr,
        shiftStartMs: startMs,
        shiftEndMs: endMs,
        autoStartShift: Boolean(config.autoStartShift),
        autoEndShift: config.autoEndShift !== false,
        autoEndTimeoutMin,
        requireManagerAuthForOvertime: config.requireManagerAuthForOvertime !== false,
        progressPercent,
        statusText,
        isWorkDay: true
    };
};
