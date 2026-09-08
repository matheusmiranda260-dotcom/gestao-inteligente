// Utilitário de cálculo de K-7s, passes e anéis de trefilação

export interface RingDef {
    name: string;
    min: number;
    max: number;
    dest: 'entry' | 'output';
    cond: 'not_last' | 'last';
}

export const RING_DEFS: RingDef[] = [
    // Output (Not Last) - CA & RT
    { name: 'CA 3,55', min: 3.5, max: 3.99, dest: 'output', cond: 'not_last' },
    { name: 'CA 4,60', min: 4.55, max: 4.70, dest: 'output', cond: 'not_last' },
    { name: 'CA 5,50', min: 5.45, max: 5.60, dest: 'output', cond: 'not_last' },
    { name: 'RT 0', min: 4.00, max: 4.99, dest: 'output', cond: 'not_last' },
    { name: 'RT 2', min: 6.00, max: 6.99, dest: 'output', cond: 'not_last' },
    { name: 'RT 3', min: 7.00, max: 7.99, dest: 'output', cond: 'not_last' },

    // Output (Last) - PR
    { name: 'PR 3,20', min: 3.15, max: 3.30, dest: 'output', cond: 'last' },
    { name: 'PR 3,40', min: 3.35, max: 3.50, dest: 'output', cond: 'last' },
    { name: 'PR 3,70', min: 3.65, max: 3.80, dest: 'output', cond: 'last' },
    { name: 'PR 3,80', min: 3.75, max: 3.90, dest: 'output', cond: 'last' },
    { name: 'PR 4,10', min: 4.05, max: 4.20, dest: 'output', cond: 'last' },
    { name: 'PR 4,20', min: 4.15, max: 4.30, dest: 'output', cond: 'last' },
    { name: 'PR 4,40', min: 4.35, max: 4.94, dest: 'output', cond: 'last' },
    { name: 'PR 5,00', min: 4.95, max: 5.10, dest: 'output', cond: 'last' },
    { name: 'PR 5,50', min: 5.45, max: 5.60, dest: 'output', cond: 'last' },
    { name: 'PR 5,60', min: 5.55, max: 5.70, dest: 'output', cond: 'last' },
    { name: 'PR 5,80', min: 5.75, max: 5.90, dest: 'output', cond: 'last' },
    { name: 'PR 6,00', min: 5.95, max: 6.10, dest: 'output', cond: 'last' },

    // Entry (Not Last) - RO
    { name: 'RO 0', min: 4.00, max: 4.99, dest: 'entry', cond: 'not_last' },
    { name: 'RO 1', min: 5.00, max: 5.99, dest: 'entry', cond: 'not_last' },
    { name: 'RO 2', min: 6.00, max: 6.99, dest: 'entry', cond: 'not_last' },
    { name: 'RO 3', min: 7.00, max: 7.99, dest: 'entry', cond: 'not_last' },

    // Entry (Last) - ROA
    { name: 'ROA 0', min: 3.49, max: 4.59, dest: 'entry', cond: 'last' },
    { name: 'ROA 1', min: 4.60, max: 5.56, dest: 'entry', cond: 'last' },
    { name: 'ROA 2', min: 5.60, max: 6.00, dest: 'entry', cond: 'last' },
];

export const ENTRY_RINGS_LIST = ['RO 3', 'RO 2', 'RO 1', 'RO 0', 'ROA 2', 'ROA 1', 'ROA 0'];
export const OUTPUT_RINGS_LIST = [
    'RT 3', 'RT 2', 'RT 0', 'CA 5,50', 'CA 4,60', 'CA 3,55',
    'PR 6,00', 'PR 5,80', 'PR 5,60', 'PR 5,50', 'PR 5,00',
    'PR 4,40', 'PR 4,20', 'PR 4,10', 'PR 3,80', 'PR 3,70', 'PR 3,40', 'PR 3,20'
];

export interface K7PassSetup {
    pass: number;
    dEntry: number;
    dOutput: number;
    reduction: number;
    entryRing: string;
    outputRing: string;
    isCustom?: boolean;
}

export const runSimulation = (n: number, dIn: number, dOut: number) => {
    if (n <= 0) return null;
    const targetRatio = Math.pow(dOut / dIn, 2);

    const getRatioFromReductions = (rStart: number, rEnd: number, steps: number) => {
        let currentRatio = 1;
        for (let i = 0; i < steps; i++) {
            const r = steps === 1 ? rStart : rStart - ((rStart - rEnd) / (steps - 1)) * i;
            currentRatio *= (1 - r);
        }
        return currentRatio;
    };

    const solveForStart = (targetVal: number, rEndFixed: number) => {
        let low = rEndFixed + 0.001;
        let high = 0.90;
        for (let k = 0; k < 30; k++) {
            const mid = (low + high) / 2;
            const ratio = getRatioFromReductions(mid, rEndFixed, n);
            if (ratio < targetVal) high = mid; else low = mid;
        }
        return (low + high) / 2;
    };

    const solveForEnd = (targetVal: number, rStartFixed: number) => {
        let low = 0.001;
        let high = rStartFixed - 0.001;
        if (high < low) high = low;
        for (let k = 0; k < 30; k++) {
            const mid = (low + high) / 2;
            const ratio = getRatioFromReductions(rStartFixed, mid, n);
            if (ratio < targetVal) high = mid; else low = mid;
        }
        return (low + high) / 2;
    };

    let bestRStart = 0;
    let bestREnd = 0.19;

    if (n === 1) {
        bestREnd = 1 - targetRatio;
        bestRStart = 1 - targetRatio;
    } else {
        const startAttempt = solveForStart(targetRatio, 0.19);
        if (startAttempt > 0.29) {
            bestRStart = 0.29;
            bestREnd = solveForEnd(targetRatio, 0.29);
        } else if (Math.abs(startAttempt - 0.19) < 0.002 || startAttempt < 0.19) {
            let found = false;
            let searchEnd = 0.18;
            for (; searchEnd > 0.01; searchEnd -= 0.01) {
                const s = solveForStart(targetRatio, searchEnd);
                if (s > searchEnd + 0.01) {
                    bestRStart = s;
                    bestREnd = searchEnd;
                    found = true;
                    break;
                }
            }
            if (!found) {
                bestRStart = 1 - Math.pow(targetRatio, 1 / n);
                bestREnd = bestRStart;
            }
        } else {
            bestRStart = startAttempt;
            bestREnd = 0.19;
        }
    }

    const calculatedDiameters: number[] = [];
    const calculatedReductions: number[] = [];
    let currentD = dIn;
    let prevArea = Math.PI * Math.pow(currentD / 2, 2);

    for (let i = 0; i < n; i++) {
        const r = n === 1 ? bestRStart : bestRStart - ((bestRStart - bestREnd) / (n - 1)) * i;
        if (i === n - 1) {
            calculatedDiameters.push(dOut);
        } else {
            const nextArea = prevArea * (1 - r);
            const nextD = 2 * Math.sqrt(nextArea / Math.PI);
            calculatedDiameters.push(parseFloat(nextD.toFixed(2)));
            currentD = nextD;
            prevArea = nextArea;
        }
        calculatedReductions.push(r * 100);
    }
    return { diameters: calculatedDiameters, reductions: calculatedReductions };
};

export const getBestRing = (diameter: number, dest: 'entry' | 'output', cond: 'not_last' | 'last'): string => {
    const candidates = RING_DEFS.filter(r => r.dest === dest && r.cond === cond);
    if (candidates.length === 0) return dest === 'entry' ? 'RO 0' : 'PR 4,20';

    const scored = candidates.map(r => {
        let dist = 0;
        if (diameter < r.min) dist = r.min - diameter;
        else if (diameter > r.max) dist = diameter - r.max;

        let physicalClash = false;
        if (dest === 'entry' && diameter > r.max) physicalClash = true;

        return { ...r, dist, physicalClash };
    });

    const possible = scored.filter(x => !x.physicalClash || x.dist < 0.1);
    const pool = possible.length > 0 ? possible : scored;

    pool.sort((a, b) => {
        if (Math.abs(a.dist - b.dist) > 0.05) return a.dist - b.dist;
        const aIn = diameter >= a.min && diameter <= a.max;
        const bIn = diameter >= b.min && diameter <= b.max;
        if (aIn && !bIn) return -1;
        if (!aIn && bIn) return 1;
        return 0;
    });

    return pool.length > 0 ? pool[0].name : (dest === 'entry' ? 'RO 0' : 'PR 4,20');
};

export const suggestDefaultK7Count = (dIn: number, dOut: number): number => {
    if (!dIn || !dOut || dIn <= dOut) return 3;
    const totalReduction = 1 - Math.pow(dOut / dIn, 2);
    if (totalReduction <= 0.32) return 1;
    if (totalReduction <= 0.52) return 2;
    if (totalReduction <= 0.74) return 3;
    return 4;
};

export const calculateK7Setup = (n: number, dIn: number, dOut: number): K7PassSetup[] => {
    const sim = runSimulation(n, dIn, dOut);
    if (!sim) return [];

    return sim.diameters.map((dOutput, idx) => {
        const isLast = idx === n - 1;
        const dEntry = idx === 0 ? dIn : sim.diameters[idx - 1];
        const entryRing = getBestRing(dEntry, 'entry', isLast ? 'last' : 'not_last');
        const outputRing = getBestRing(dOutput, 'output', isLast ? 'last' : 'not_last');

        return {
            pass: idx + 1,
            dEntry,
            dOutput,
            reduction: sim.reductions[idx],
            entryRing,
            outputRing
        };
    });
};
