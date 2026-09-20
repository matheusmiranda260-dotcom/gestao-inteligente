import { MachineShiftConfig, PcpShiftConfig } from '../types';

export const DEFAULT_GLOBAL_SHIFT_CONFIG: PcpShiftConfig = {
    id: 'default',
    workStart: '07:00',
    lunchStart: '12:00',
    lunchEnd: '13:00',
    workEnd: '17:00',
    workDays: [1, 2, 3, 4, 5],
    noLunch: false,
    autoStartShift: true,
    autoEndShift: true,
    autoEndTimeoutMin: 5,
    requireManagerAuthForOvertime: true,
};

export const DEFAULT_MACHINE_SHIFTS: Record<string, MachineShiftConfig> = {
    'Trefila 1': {
        workStart: '07:45',
        workEnd: '17:33',
        noLunch: true,
        shiftCount: 1,
        workDays: [1, 2, 3, 4, 5],
        autoStartShift: true,
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
        autoStartShift: true,
        autoEndShift: true,
        autoEndTimeoutMin: 5,
        requireManagerAuthForOvertime: true
    },
    'Treliça 1': {
        workStart: '05:00',
        workEnd: '14:44',
        noLunch: false,
        lunchStart: '11:30',
        lunchEnd: '12:30',
        shiftCount: 2,
        shift2Start: '14:00',
        shift2End: '23:59',
        workDays: [1, 2, 3, 4, 5],
        autoStartShift: true,
        autoEndShift: true,
        autoEndTimeoutMin: 5,
        requireManagerAuthForOvertime: true
    },
    'Treliça 2': {
        workStart: '05:00',
        workEnd: '14:44',
        noLunch: false,
        lunchStart: '11:30',
        lunchEnd: '12:30',
        shiftCount: 2,
        shift2Start: '14:00',
        shift2End: '23:59',
        workDays: [1, 2, 3, 4, 5],
        autoStartShift: true,
        autoEndShift: true,
        autoEndTimeoutMin: 5,
        requireManagerAuthForOvertime: true
    },
    'Malha 1': {
        workStart: '07:00',
        workEnd: '17:00',
        noLunch: false,
        lunchStart: '12:00',
        lunchEnd: '13:00',
        shiftCount: 1,
        workDays: [1, 2, 3, 4, 5],
        autoStartShift: true,
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
    const custom = globalConfig?.machineConfigs?.[rawMachName];
    if (custom && custom.workStart && custom.workEnd) {
        return {
            workDays: custom.workDays || globalConfig?.workDays || [1, 2, 3, 4, 5],
            autoStartShift: custom.autoStartShift !== undefined ? custom.autoStartShift : (globalConfig?.autoStartShift !== false),
            autoEndShift: custom.autoEndShift !== undefined ? custom.autoEndShift : (globalConfig?.autoEndShift !== false),
            autoEndTimeoutMin: custom.autoEndTimeoutMin || globalConfig?.autoEndTimeoutMin || 5,
            requireManagerAuthForOvertime: custom.requireManagerAuthForOvertime !== undefined ? custom.requireManagerAuthForOvertime : (globalConfig?.requireManagerAuthForOvertime !== false),
            ...custom
        };
    }

    // Default específico por máquina
    if (DEFAULT_MACHINE_SHIFTS[rawMachName]) {
        return { ...DEFAULT_MACHINE_SHIFTS[rawMachName] };
    }

    // Fallback para o globalConfig ou default da fábrica
    return {
        workStart: globalConfig?.workStart || '07:00',
        workEnd: globalConfig?.workEnd || '17:00',
        noLunch: globalConfig?.noLunch || false,
        lunchStart: globalConfig?.lunchStart || '12:00',
        lunchEnd: globalConfig?.lunchEnd || '13:00',
        workDays: globalConfig?.workDays || [1, 2, 3, 4, 5],
        shiftCount: 1,
        autoStartShift: globalConfig?.autoStartShift !== false,
        autoEndShift: globalConfig?.autoEndShift !== false,
        autoEndTimeoutMin: globalConfig?.autoEndTimeoutMin || 5,
        requireManagerAuthForOvertime: globalConfig?.requireManagerAuthForOvertime !== false
    };
};

export interface MachineShiftEvaluation {
    inShiftWindow: boolean;
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

const parseHourMin = (timeStr: string) => {
    if (!timeStr || !timeStr.includes(':')) return { h: 7, m: 0 };
    const parts = timeStr.split(':');
    return { h: parseInt(parts[0], 10) || 0, m: parseInt(parts[1], 10) || 0 };
};

/**
 * Avalia em tempo real a situação do turno para uma máquina.
 */
export const checkMachineShiftStatus = (
    machineName: string,
    globalConfig?: PcpShiftConfig | null,
    refDate: Date = new Date()
): MachineShiftEvaluation => {
    const config = resolveMachineShiftConfig(machineName, globalConfig);
    const dayOfWeek = refDate.getDay(); // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
    const workDays = config.workDays || [1, 2, 3, 4, 5];
    const isWorkDay = workDays.includes(dayOfWeek);

    const nowMs = refDate.getTime();
    const currentH = refDate.getHours();
    const currentM = refDate.getMinutes();
    const currentVal = currentH + currentM / 60;

    let activeShiftName = 'Turno Padrão';
    let sStartStr = config.workStart || '07:00';
    let sEndStr = config.workEnd || '17:00';

    if (config.shiftCount === 2 && config.shift2Start && config.shift2End) {
        const s1 = parseHourMin(config.workStart);
        const s2 = parseHourMin(config.shift2Start);
        const s1Val = s1.h + s1.m / 60;
        const s2Val = s2.h + s2.m / 60;

        // Se estamos antes da metade ou antes do Turno 2
        if (currentVal < s2Val && currentVal >= (s1Val - 1)) {
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

    const shiftStart = new Date(refDate);
    shiftStart.setHours(startH, startM, 0, 0);

    const shiftEnd = new Date(refDate);
    shiftEnd.setHours(endH, endM, 0, 0);

    // Tratamento para turnos noturnos que viram a meia-noite
    if (endH < startH) {
        if (currentH <= endH) {
            shiftStart.setDate(shiftStart.getDate() - 1);
        } else {
            shiftEnd.setDate(shiftEnd.getDate() + 1);
        }
    }

    const startMs = shiftStart.getTime();
    const endMs = shiftEnd.getTime();
    const autoTimeoutMin = config.autoEndTimeoutMin || 5;
    const autoTimeoutMs = autoTimeoutMin * 60 * 1000;

    // Tolerância de 10 min de antecedência para iniciar turno
    const earlyToleranceMs = 10 * 60 * 1000;
    const isWithinHours = nowMs >= (startMs - earlyToleranceMs) && nowMs <= endMs;
    const inShiftWindow = isWorkDay && isWithinHours;

    let isOvertime = !inShiftWindow;
    let isAutoEndCountdown = false;
    let remainingCountdownSeconds = 0;

    // Se passou do horário de encerramento
    if (nowMs >= endMs) {
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
        isOvertime,
        isAutoEndCountdown,
        remainingCountdownSeconds,
        shiftName: activeShiftName,
        shiftLabel: `${sStartStr} - ${sEndStr}`,
        workStart: sStartStr,
        workEnd: sEndStr,
        shiftStartMs: startMs,
        shiftEndMs: endMs,
        autoStartShift: config.autoStartShift !== false,
        autoEndShift: config.autoEndShift !== false,
        autoEndTimeoutMin: autoTimeoutMin,
        requireManagerAuthForOvertime: config.requireManagerAuthForOvertime !== false,
        progressPercent,
        statusText,
        isWorkDay
    };
};
