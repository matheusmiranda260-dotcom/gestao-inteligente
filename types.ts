// types.ts

export type Page = 'login' | 'menu' | 'stock' | 'stockAdd' | 'stockTransfer' | 'finishedGoods' | 'productionOrderTrelica' | 'productionOrder' | 'productionDashboard' | 'meetingsTasks' | 'continuousImprovement' | 'peopleManagement' | 'trefila' | 'trefilaInProgress' | 'trefilaPending' | 'trefilaCompleted' | 'trefilaRings' | 'trefilaReports' | 'trefilaWeighing' | 'trefilaTemplates' | 'trefilaParts' | 'trelica' | 'trelicaInProgress' | 'trelicaPending' | 'trelicaCompleted' | 'trelicaReports' | 'trelicaParts' | 'reports' | 'laboratory' | 'userManagement' | 'gaugesManager' | 'partsManager' | 'workInstructions' | 'people' | 'finished_goods' | 'spare_parts' | 'quality' | 'instructions' | 'weighing' | 'meetings';

export type MachineType = 'Trefila-01' | 'Trefila-02' | 'Trefila-03' | 'Trefila-04' | 'Treliça-01' | 'Treliça-02' | 'Treliça-03' | 'Treliça-04' | 'Corte-01' | 'Corte-02' | 'Trefila' | 'Treliça' | 'Geral' | 'Empilhadeira';

export type MaterialType = 'Arame' | 'Treliça' | 'Ponta' | 'Fio Máquina' | 'Sucata' | 'CA-60' | 'CA-50';

export type Bitola = string; // e.g., '3.40', '4,20', '8.00'

export interface User {
    id: string;
    username: string;
    password?: string;
    role: 'admin' | 'user' | 'gestor';
    permissions?: Partial<Record<Page, boolean>>;
    employeeId?: string;
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

    // Personnel Details
    jobTitle?: string;
    admissionDate?: string;
    birthDate?: string;
    maritalStatus?: string;
    childrenCount?: number;
    phone?: string;
    email?: string;
    managerId?: string;
    orgPositionId?: string;
}

export interface StockItem {
    id: string;
    internalLot: string;
    supplierLot?: string;
    runNumber?: string;
    model?: string;
    bitola: Bitola;
    quantity?: number;
    weight?: number;
    labelWeight?: number;
    initialQuantity?: number;
    remainingQuantity: number;
    sector?: string;
    materialType: MaterialType | string;
    supplier?: string;
    nfe?: string;
    conferenceNumber?: string;
    entryDate?: string;
    status: string;
    history?: any[];
    lastMovement?: string;
    subSlot?: string;
    productionOrderIds?: string[];
    location?: string;
    lastAuditDate?: string;
    auditObservation?: string;
    steelType?: string;
}

export interface ConferenceLotData {
    internalLot: string;
    runNumber: string;
    steelType: string;
    materialType: string | MaterialType;
    bitola: Bitola;
    labelWeight: number;
    supplier?: string;
}

export interface ConferenceData {
    id: string;
    date: string;
    entryDate: string;
    operator: string;
    supplier: string;
    nfe: string;
    conferenceNumber: string;
    lots: ConferenceLotData[];
}

export interface ProductionOrderData {
    id: string;
    orderNumber: string;
    startTime: string;
    endTime?: string;
    creationDate?: string;
    status: 'Inativa' | 'Ativa' | 'Finalizado' | 'pending' | 'completed' | 'Cancelada' | string;
    machine: MachineType;
    operator: string;
    targetBitola: Bitola;
    trelicaModel?: string;
    tamanho?: string;
    quantityToProduce: number;
    scraps?: { type: string; weight: number }[];
    stops?: { reason: string; duration: number }[];
    totalProducedMeters?: number;
    totalProducedWeight?: number;
    actualProducedWeight?: number;
    actualProducedQuantity?: number;
    plannedOutputWeight?: number;
    averageSpeed?: number;
    summary?: any;
    selectedLotIds?: any;
    totalWeight?: number;
    weighedPackages?: any[];
    processedLots?: any[];
    downtimeEvents?: any[];
    operatorLogs?: any[];
    activeLotProcessing?: { lotId: string; startTime: string };
    pontas?: Ponta[];
    lastQuantityUpdate?: string;
    scrapWeight?: number;
    scrapx?: { type: string; weight: number }[]; // Compatibility if typo was used
    inputBitola?: string;
    isGhostOrder?: boolean;
}

export interface TransferRecord {
    id: string;
    date: string;
    operator: string;
    destinationSector: string;
    transferredLots: TransferredLotInfo[];
}

export interface TransferredLotInfo {
    id?: string;
    lotId?: string;
    internalLot?: string;
    materialType?: string;
    bitola?: string;
    transferredQuantity?: number;
    model?: string;
    quantity?: number;
    weight?: number;
    originalSector?: string;
}

export interface ProductionRecord {
    id: string;
    productionOrderId?: string;
    date: string;
    machine: MachineType;
    operator?: string;
    producedWeight: number;
    producedQuantity?: number;
    bitola?: Bitola;
    model?: string;
    consumedLots?: any[];
}

export interface PartsRequest {
    id: string;
    date: string;
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
    machine: MachineType;
    operator: string;
    productionOrderId: string;
    orderNumber?: string;
    targetBitola?: Bitola;
    trelicaModel?: string;
    tamanho?: string;
    quantityToProduce?: number;
    shiftStartTime?: string;
    shiftEndTime?: string;
    processedLots?: any[];
    downtimeEvents?: any[];
    totalProducedQuantity?: number;
    totalProducedWeight?: number;
    totalProducedMeters?: number;
    totalScrapWeight?: number;
    scrapPercentage?: number;
    date?: string;

    // Optional old fields
    startTime?: string;
    endTime?: string;
    totalWeight?: number;
    totalPcs?: number;
    scraps?: { type: string; weight: number }[];
    stops?: { reason: string; duration: number }[];
}

export interface ProcessedLot {
    lotId: string;
    finalWeight: number | null;
    measuredGauge?: number;
    startTime: string;
    endTime: string;
}

export interface DowntimeEvent {
    id?: string;
    stopTime: string;
    resumeTime: string | null;
    reason: string;
}

export interface OperatorLog {
    operator: string;
    startTime: string;
    endTime?: string | null;
    startQuantity?: number;
    endQuantity?: number;
}

export interface WeighedPackage {
    id?: string;
    weight: number;
    timestamp: string;
    packageNumber: number;
    quantity?: number;
}

export interface FinishedProductItem {
    id: string;
    productionDate: string;
    productionOrderId: string;
    orderNumber: string;
    productType: 'Treliça';
    model: string;
    size: string;
    quantity: number;
    totalWeight: number;
    status: 'Disponível' | 'Vendido' | 'Transferido';
}

export interface Ponta {
    size: number;
    weight?: number;
    quantity: number;
    totalWeight: number;
}

export interface PontaItem {
    id: string;
    productionDate: string;
    productionOrderId: string;
    orderNumber: string;
    productType: 'Ponta de Treliça';
    model: string;
    size: string;
    quantity: number;
    totalWeight: number;
    status: 'Disponível' | 'Vendido' | 'Transferido';
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
    date: string;
    operator: string;
    destinationSector: string;
    otherDestination?: string;
    transferredItems: TransferredFinishedGoodInfo[];
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

export interface MeetingItem {
    id: string;
    content: string;
    completed: boolean;
    completedAt?: string;
    itemType?: 'improvement' | 'idea';
    dueDate?: string;
    category?: string;
    pauta?: string;
}

export interface Meeting {
    id: string;
    title: string;
    meetingDate: string;
    categoryId?: string;
    createdAt?: string;
    author?: string;
    items: MeetingItem[];
}

export interface MeetingCategory {
    id: string;
    label: string;
    icon_name?: string;
}

export interface StickyNote {
    id: string;
    content: string;
    color: string;
    author: string;
    date: string;
    completed?: boolean;
}

export interface StockGauge {
    id: string;
    gauge: string;
    materialType: MaterialType | string;
    minWeight?: number;
    idealWeight?: number;
    productCode?: string;
}

export interface LabAnalysisEntry {
    id: string;
    lote: string;
    fornecedor: string;
    bitola_mp?: string;
    bitola_saida_ideal?: string;
    qtd_k7_ideal?: string;
    k7_1_ideal?: number | null;
    k7_2_ideal?: number | null;
    k7_3_ideal?: number | null;
    k7_4_ideal?: number | null;
    k7_1_entrada: number | null;
    k7_1_saida: number | null;
    k7_2_entrada: number | null;
    k7_2_saida: number | null;
    k7_3_entrada: number | null;
    k7_3_saida: number | null;
    k7_4_entrada: number | null;
    k7_4_saida: number | null;
    velocidade: number | null;
    comprimento: number | null;
    massa: number | null;
    escoamento: number | null;
    resistencia: number | null;
    alongamento: number | null;
    date: string;
    operator: string;
}

export interface TrefilaRecipe {
    id: string;
    name: string;
    type: string;
    entryDiameter: number;
    finalDiameter: number;
    passes: number;
    passDiameters: number[];
    passRings: { entry: string; output: string }[];
}

export interface TrefilaRingStock {
    id: string;
    model: string;
    quantity: number;
}

export interface Evaluation {
    id: string;
    employeeId: string;
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
    type: string;
    title: string;
    description?: string;
    date: string;
}

export interface EmployeeCourse {
    id: string;
    employeeId: string;
    courseName: string;
    institution?: string;
    educationType?: string;
    completionDate?: string | null;
    expiryDate?: string | null;
    workloadHours?: number | null;
    status: string;
    attachmentUrl?: string | null;
}

export interface EmployeeAbsence {
    id: string;
    employeeId: string;
    type: string;
    startDate: string;
    endDate?: string | null;
    reason: string;
    attachmentUrl?: string | null;
}

export interface EmployeeVacation {
    id: string;
    employeeId: string;
    period?: string;
    startDate: string;
    endDate: string;
    status: string;
}

export interface EmployeeResponsibility {
    id: string;
    employeeId: string;
    description: string;
    isCritical: boolean;
}

export interface OrgUnit {
    id: string;
    name: string;
    unitType?: string;
    parentId?: string;
    displayOrder: number;
}

export interface OrgPosition {
    id: string;
    orgUnitId: string;
    title: string;
    description?: string;
    isLeadership: boolean;
    displayOrder: number;
}

export interface EmployeeDocument {
    id: string;
    employeeId: string;
    title: string;
    type: string;
    url: string;
    createdAt?: string;
}

export interface TrelicaSelectedLots {
    [key: string]: any;
}

export interface SparePart {
    id: string;
    name: string;
    model: string;
    machine: string;
    currentStock: number;
    minStock: number;
    imageUrl?: string;
}

export interface PartUsage {
    id: string;
    date: string;
    quantity: number;
    machine: string;
    reason: string;
    user: string;
    type: 'IN' | 'OUT';
}

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

export const trelicaLabels = ['H08 (8m)', 'H12 (12m)', 'H6 (6m)', 'H10 (10m)'];
export const MaterialOptions = ['Fio Máquina', 'CA-60'];
export const FioMaquinaBitolaOptions = ['8.00', '7.00', '6.50', '6.35', '5.50'];
export const CA60BitolaOptions = ['3.20', '3.40', '3.80', '4.20', '4.40', '4.90', '5.00', '5.50', '5.60', '5.80', '6.00', '6.35', '7.00'];
export const TrefilaBitolaOptions = CA60BitolaOptions; // Keeping for compatibility
export const SteelTypeOptions = ['1006', '1008', '1010', '1012', '1015', '1018', 'Outro'];
