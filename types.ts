// types.ts

export interface TrelicaSelectedLots {
    superior: string;
    inferior1: string;
    inferior2: string;
    senozoide1: string;
    senozoide2: string;
    allSuperior?: string[];
    allInferior?: string[];
    allSenozoide?: string[];
    allInferiorLeft?: string[];
    allInferiorRight?: string[];
    allSenozoideLeft?: string[];
    allSenozoideRight?: string[];
}

export type Page = 'login' | 'menu' | 'stock' | 'stock_map' | 'stock_add' | 'stock_inventory' | 'stock_transfer' | 'machineSelection' | 'trefila' | 'trelica' | 'productionOrder' | 'productionOrderTrelica' | 'reports' | 'userManagement' | 'productionDashboard' | 'finishedGoods' | 'partsManager' | 'continuousImprovement' | 'workInstructions' | 'peopleManagement';

export interface InstructionStep {
    id: string;
    order: number;
    title: string;
    description: string;
    photoUrl?: string;
}

export interface WorkInstruction {
    id: string;
    title: string;
    machine: string;
    description: string;
    steps: InstructionStep[];
    updatedAt?: string;
}

export interface PartUsage {
    id: string;
    date: string; // ISO string
    quantity: number;
    machine: string;
    reason?: string;
    user?: string;
    type?: 'IN' | 'OUT';
}

export interface SparePart {
    id: string;
    name: string;
    description?: string;
    model: string;
    machine: string;
    currentStock: number;
    minStock: number;
    location?: string;
    lastUpdated?: string;
    imageUrl?: string;
    history?: PartUsage[];
}

export type MachineType = 'Trefila' | 'Treliça';

export const FioMaquinaBitolaOptions = ['8.00', '7.00', '6.50', '6.35', '5.50'] as const;
export const TrefilaBitolaOptions = ['3.40', '3.80', '4.20', '4.60', '5.00', '5.40', '6.00', '6.35', '3.20', '5.60', '5.80', '8.00', '6.00', '5.00'] as const;
export type Bitola = typeof FioMaquinaBitolaOptions[number] | typeof TrefilaBitolaOptions[number];

export const MaterialOptions = ['Fio Máquina', 'CA-60'] as const;
export type MaterialType = typeof MaterialOptions[number];

export interface HistoryEvent {
    type: string;
    date: string; // ISO string
    details: Record<string, string | number>;
}

export interface StockItem {
    id: string;
    entryDate: string; // ISO string
    supplier: string;
    nfe: string;
    conferenceNumber: string;
    internalLot: string;
    supplierLot: string;
    runNumber: string;
    materialType: MaterialType;
    bitola: Bitola;
    labelWeight: number;
    initialQuantity: number;
    remainingQuantity: number;
    status: 'Disponível' | 'Em Produção' | 'Em Produção - Treliça' | 'Em Produção - Trefila' | 'Transferido' | 'Disponível - Suporte Treliça' | 'CA-60' | 'Consumido para fazer treliça';
    history?: HistoryEvent[];
    productionOrderIds?: string[];
    location?: string | null;
    lastAuditDate?: string | null;
    auditObservation?: string | null;
}

export interface ConferenceLotData {
    internalLot: string;
    supplierLot: string;
    runNumber: string;
    bitola: Bitola;
    materialType: MaterialType;
    labelWeight: number;
    scaleWeight: number;
    supplier?: string;
}

export interface ConferenceData {
    id?: string;
    entryDate: string; // ISO string
    supplier: string;
    nfe: string;
    conferenceNumber: string;
    lots: ConferenceLotData[];
}

export interface ProductionRecord {
    id: string;
    date: string; // ISO string
    machine: MachineType;
    producedWeight: number;
    consumedLots: { id: string; consumedQuantity: number }[];
    scrapWeight?: number;
}

export interface User {
    id: string;
    username: string;
    password: string;
    role: 'admin' | 'user' | 'gestor';
    permissions?: Partial<Record<Page, boolean>>;
    employeeId?: string;
}

export interface DowntimeEvent {
    stopTime: string; // ISO string
    resumeTime: string | null; // ISO string or null
    reason: string;
}

export interface ProcessedLot {
    lotId: string;
    finalWeight: number | null;
    measuredGauge?: number; // Bitola aferida em mm
    startTime: string; // ISO string
    endTime: string; // ISO string
}

export interface OperatorLog {
    operator: string;
    startTime: string; // ISO string
    endTime?: string | null; // ISO string or null
    postProductionActivities?: {
        timestamp: string; // ISO string
        description: string;
    }[];
}

export interface WeighedPackage {
    packageNumber: number;
    quantity: number;
    weight: number;
    timestamp: string;
}

export interface Ponta {
    quantity: number;
    size: number; // in meters
    totalWeight: number;
}

export interface ProductionOrderData {
    id: string;
    orderNumber: string;
    machine: MachineType;
    targetBitola: Bitola;
    trelicaModel?: string;
    tamanho?: string;
    quantityToProduce?: number;
    selectedLotIds: string[] | TrelicaSelectedLots;
    totalWeight: number; // Peso da matéria prima
    plannedOutputWeight?: number; // Peso planejado do produto final (ex: Qtd * Peso Final da Treliça)
    status: 'pending' | 'in_progress' | 'completed';
    creationDate: string; // ISO string
    startTime?: string; // ISO string
    endTime?: string; // ISO string
    downtimeEvents?: DowntimeEvent[];
    processedLots?: ProcessedLot[];
    actualProducedWeight?: number;
    operatorLogs?: OperatorLog[];
    activeLotProcessing?: { lotId?: string; startTime?: string; } | null;
    actualProducedQuantity?: number;
    scrapWeight?: number;
    weighedPackages?: WeighedPackage[];
    pontas?: Ponta[];
}

export interface FinishedProductItem {
    id: string;
    productionDate: string; // ISO string
    productionOrderId: string;
    orderNumber: string;
    productType: 'Treliça';
    model: string;
    size: string;
    quantity: number;
    totalWeight: number;
    status: 'Disponível' | 'Vendido' | 'Transferido';
}

export interface PontaItem {
    id: string;
    productionDate: string; // ISO string
    productionOrderId: string;
    orderNumber: string;
    productType: 'Ponta de Treliça';
    model: string;
    size: string; // The size of the ponta, e.g., "7" for 7m
    quantity: number;
    totalWeight: number;
    status: 'Disponível' | 'Vendido' | 'Transferido';
}

export interface PartsRequest {
    id: string;
    date: string; // ISO string
    operator: string;
    machine: MachineType;
    productionOrderId: string;
    partDescription: string;
    quantity: number;
    priority: 'Normal' | 'Urgente';
    status: 'Pendente' | 'Atendido';
}

export interface ShiftReport {
    id: string;
    date: string; // End of shift date
    operator: string;
    machine: MachineType;
    productionOrderId: string;
    orderNumber: string;
    targetBitola: Bitola;
    trelicaModel?: string;
    tamanho?: string;
    quantityToProduce?: number;
    shiftStartTime: string;
    shiftEndTime: string;
    processedLots: ProcessedLot[];
    downtimeEvents: DowntimeEvent[];
    totalProducedWeight: number;
    totalProducedMeters: number;
    totalScrapWeight: number;
    scrapPercentage: number;
}

export interface TransferredLotInfo {
    lotId: string;
    internalLot: string;
    materialType: MaterialType;
    bitola: Bitola;
    transferredQuantity: number;
}

export interface TransferRecord {
    id: string; // e.g., TRANSF-001
    date: string; // ISO string
    operator: string;
    destinationSector: string;
    transferredLots: TransferredLotInfo[];
}

export interface TransferredFinishedGoodInfo {
    productId: string;
    productType: 'Treliça' | 'Ponta de Treliça';
    model: string;
    size: string;
    transferredQuantity: number;
    totalWeight: number;
}

export interface FinishedGoodsTransferRecord {
    id: string;
    date: string; // ISO string
    operator: string;
    destinationSector: string;
    otherDestination?: string;
    transferredItems: TransferredFinishedGoodInfo[];
}

export interface TrefilaRecipe {
    id: string;
    name: string;
    type: 'K-7 CA 60' | string;
    entryDiameter: number;
    finalDiameter: number;
    passes: number;
    passDiameters: number[];
    passRings: { entry: string; output: string }[];
    createdAt?: string;
}

export interface TrefilaRingStock {
    id: string;
    model: string;
    quantity: number;
}

export interface KaizenAction {
    id: string;
    date: string;
    description: string;
    photoUrl?: string;
    type: 'action' | 'resolution';
}

export interface KaizenProblem {
    id: string;
    description: string;
    sector: string;
    responsible: string;
    status: 'Aberto' | 'Em melhoria' | 'Resolvido';
    date: string;
    photoUrl?: string;
    history: KaizenAction[];
    responsibleIds?: string[];
}

export interface Employee {
    id: string;
    name: string;
    photoUrl?: string; // Mapped from photo_url
    sector: string;
    shift: string;
    active: boolean;
    appUserId?: string;
    createdAt?: string;
    // New fields
    jobTitle?: string;
    admissionDate?: string;
    birthDate?: string;
    maritalStatus?: string;
    childrenCount?: number;
    phone?: string;
    email?: string;
    managerId?: string;
    orgPositionId?: string; // Link to the Org Chart Position
}

export interface OrgUnit {
    id: string;
    name: string;
    unitType?: 'machine' | 'department' | 'sector';
    parentId?: string;
    displayOrder: number;
}

export interface OrgPosition {
    id: string;
    orgUnitId: string;
    title: string;
    isLeadership: boolean;
    displayOrder: number;
}

export interface EmployeeCourse {
    id: string;
    employeeId: string;
    courseName: string;
    institution?: string;
    completionDate?: string;
    expiryDate?: string;
    status: 'Concluído' | 'Em Andamento' | 'Pendente';
    educationType?: 'Escolaridade' | 'Graduação' | 'Pós-Graduação' | 'Técnico' | 'Curso Livre' | 'Certificação';
    attachmentUrl?: string; // Link to certificate/diploma
    workloadHours?: number;
}

export interface EmployeeAbsence {
    id: string;
    employeeId: string;
    startDate: string;
    endDate?: string;
    reason: string;
    type?: string;
    attachmentUrl?: string;
}

export interface EmployeeVacation {
    id: string;
    employeeId: string;
    startDate: string;
    endDate: string;
    status: 'Programada' | 'Gozada' | 'Vendida' | 'Cancelada';
}

export interface EmployeeResponsibility {
    id: string;
    employeeId: string;
    description: string;
    isCritical: boolean;
}

export interface Evaluation {
    id: string;
    employeeId: string; // Mapped from employee_id
    evaluator: string;
    date: string;
    organizationScore: number;
    cleanlinessScore: number;
    effortScore: number;
    communicationScore: number;
    improvementScore: number;
    totalScore: number;
    note?: string;
    photoUrl?: string;
}

export interface Achievement {
    id: string;
    employeeId: string;
    type: 'model_area' | 'idea_month' | 'highlight_week' | 'custom';
    title: string;
    description?: string;
    date: string;
}

export interface EmployeeDocument {
    id: string;
    employeeId: string;
    title: string;
    type: string;
    url: string;
    createdAt: string;
}

export interface InventorySession {
    id: string;
    materialType: MaterialType;
    bitola: Bitola;
    startDate: string;
    endDate?: string | null;
    status: 'open' | 'completed';
    operator: string;
    itemsCount: number;
    checkedCount: number;
    auditedLots: {
        lotId: string;
        internalLot: string;
        systemWeight: number;
        physicalWeight: number;
        observation?: string | null;
    }[];
}

export interface RowConfig {
    rowName: string;
    baseSize: number;
    maxHeight: number;
}
