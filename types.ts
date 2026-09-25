// types.ts

export type Page = 'login' | 'menu' | 'stock' | 'stockAdd' | 'stockTransfer' | 'documents' | 'finishedGoods' | 'trelicaStock' | 'productionOrderTrelica' | 'productionOrder' | 'productionDashboard' | 'meetingsTasks' | 'continuousImprovement' | 'peopleManagement' | 'trefila' | 'trefilaInProgress' | 'trefilaPending' | 'trefilaCompleted' | 'trefilaRings' | 'trefilaBitolaCheck' | 'trefilaReports' | 'trefilaWeighing' | 'trefilaTemplates' | 'trefilaParts' | 'trelica' | 'trelicaInProgress' | 'trelicaPending' | 'trelicaCompleted' | 'trelicaReports' | 'trelicaParts' | 'malha' | 'malhaInProgress' | 'malhaPending' | 'malhaCompleted' | 'malhaReports' | 'productionOrderMalha' | 'malhaControl' | 'reports' | 'laboratory' | 'userManagement' | 'gaugesManager' | 'partsManager' | 'electrodesStock' | 'workInstructions' | 'people' | 'finished_goods' | 'spare_parts' | 'quality' | 'instructions' | 'weighing' | 'meetings' | 'downtimeConfigs' | 'desbobinadeira' | 'desbobinadeiraDashboard' | 'desbobinadeiraInProgress' | 'desbobinadeiraPending' | 'desbobinadeiraCompleted' | 'desbobinadeiraReports' | 'productionOrderDesbobinadeira' | 'trefilaControl' | 'trelicaControl' | 'pcpBoard' | 'productionScheduling' | 'productsManagement';

export interface DowntimeConfig {
    id: string;
    reason: string;
    thresholdMinutes: number;
    machineType: string;
    isActive: boolean;
}

export interface ProductionSchedule {
    id: string;
    machine: string; // 'Trefila', 'Treliça 1', 'Treliça 2', 'Malha'
    date: string; // YYYY-MM-DD
    item: string; // Product name or details
    targetQuantity: number; // Numeric target
    status: 'Agendado' | 'Em Produção' | 'Concluído';
    notes?: string;
    createdAt?: string;
}

export interface Document {
    id: string;
    title: string;
    category?: string;
    url: string;
    createdAt?: string;
    author?: string;
    fileType?: string;
}

export interface EmployeeDocument {
    id: string;
    employeeId: string;
    title: string;
    type: string;
    url: string;
    createdAt?: string;
}

export type MachineType = 'Trefila 1' | 'Trefila 2' | 'Treliça 1' | 'Treliça 2' | 'Malha' | 'Malha 1' | 'Malha 2' | 'Corte-01' | 'Corte-02' | 'Trefila' | 'Treliça' | 'Geral' | 'Empilhadeira' | 'Desbobinadeira 1';

export type MaterialType = 'Arame' | 'Treliça' | 'Ponta' | 'Fio Máquina' | 'Sucata' | 'CA-60' | 'CA-50' | 'Eletrodos Treliças' | 'Sabão' | 'Malha';

export type Bitola = string; // e.g., '3.40', '4,20', '8.00'

export interface TrelicaModel {
    id: string;
    cod: string;
    modelo: string;
    tamanho: string;
    superior: string;
    inferior: string;
    senozoide: string;
    peso_final: string;
    peso_superior: string;
    peso_senozoide: string;
    peso_inferior: string;
    pesoFinal?: string;
    pesoSuperior?: string;
    pesoSenozoide?: string;
    pesoInferior?: string;
    created_at?: string;
}

export interface User {
    id: string;
    username: string;
    password?: string;
    role: 'admin' | 'user' | 'gestor';
    permissions?: Partial<Record<Page, boolean>>;
    employeeId?: string;
    isOnline?: boolean;
    loginCount?: number;
    lastLoginAt?: string;
    sessionVersion?: number;
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
    assignedMachine?: string;
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
    productCode?: string;
    description?: string;
}

export interface ConferenceLotData {
    internalLot: string;
    runNumber: string;
    steelType: string;
    materialType: string | MaterialType;
    bitola: Bitola;
    labelWeight: number;
    quantity?: number;
    supplier?: string;
    productCode?: string;
    description?: string;
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
    malhaModel?: string;
    malhaPieces?: number;
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
    usedLotIds?: string[];
    totalWeight?: number;
    weighedPackages?: any[];
    processedLots?: any[];
    downtimeEvents?: any[];
    operatorLogs?: any[];
    activeLotProcessing?: { lotId: string; startTime: string; speed?: number };
    pontas?: Ponta[];
    lastQuantityUpdate?: string;
    scrapWeight?: number;
    scrapx?: { type: string; weight: number }[]; // Compatibility if typo was used
    inputBitola?: string;
    isGhostOrder?: boolean;
    trelicaSuperior?: string;
    trelicaInferior?: string;
    trelicaSinusoide?: string;
    scheduledMachine?: string;
    plannedStartDate?: string;
    plannedEndDate?: string;
    estimatedDurationDays?: number;
    targetSpeed?: number;
    rollChangeTimeMinutes?: number;
    setupTimeMinutes?: number;
    estimatedProductionHours?: number;
    dailyWorkHours?: number;
    shiftConfig?: { workStart: string; lunchStart: string; lunchEnd: string; workEnd: string };
    k7Count?: number;
    k7Setup?: any[];
    productCode?: string;
    productDescription?: string;
    pieceWeight?: number;
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
    isOvertime?: boolean;
    managerAuthorized?: string;
    autoClosed?: boolean;
    observation?: string;
}

export interface ProcessedLot {
    lotId: string;
    finalWeight?: number;
    processedWeight?: number;
    grossWeight?: number;
    initialWeight?: number;
    spoolWeight?: number;
    wasteWeight?: number;
    startTime: string;
    endTime: string;
}

export interface DowntimeEvent {
    stopTime: string;
    resumeTime: string | null;
    reason: string;
    justification?: string;
}

export interface OperatorLog {
    operator: string;
    startTime: string;
    endTime?: string | null;
    startQuantity?: number;
    endQuantity?: number;
    isOvertime?: boolean;
    managerAuthorized?: string;
    autoClosed?: boolean;
    pendingOperatorCheckin?: boolean;
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
    physicalQuantity: number;
    pendingTransferQuantity?: number;
    totalWeight: number;
    status: 'Disponível' | 'Vendido' | 'Transferido';
    movementHistory?: StockMovement[];
    isConferred?: boolean;
    conferralJustification?: string;
    opStartTime?: string;
    opEndTime?: string;
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
    physicalQuantity: number;
    pendingTransferQuantity?: number;
    totalWeight: number;
    status: 'Disponível' | 'Vendido' | 'Transferido';
    movementHistory?: StockMovement[];
    isConferred?: boolean;
    conferralJustification?: string;
    opStartTime?: string;
    opEndTime?: string;
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

export interface StockMovement {
    id: string;
    date: string;
    type: 'transfer' | 'adjustment' | 'out' | 'addition';
    from: 'virtual' | 'physical' | 'system' | 'out' | 'production';
    to: 'virtual' | 'physical' | 'system' | 'out' | 'production';
    quantity: number;
    operator: string;
    observations?: string;
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
    description?: string;
    // Parâmetros técnicos para Treliça
    tamanho?: string;
    superior?: string;
    inferior?: string;
    senozoide?: string;
    peso_final?: string;
    peso_superior?: string;
    peso_inferior?: string;
    peso_senozoide?: string;
    // Parâmetros técnicos para Malha Soldada Industrial
    longitudinal?: string;
    transversal?: string;
    linearMeters?: number;
    meshSpacing?: string;
    panelDimensions?: string;
    peso_peca?: number | string;
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
    productionOrderId?: string;
    productionOrderNumber?: string;
    setupProfile?: 'descrescente' | 'linear';
    actionTaken?: string;
    actionResult?: string;
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

export interface TechnicalEvaluation {
    id: string;
    employeeId: string;
    evaluator: string;
    date: string;
    monthNum: number;
    machineType: string;
    
    // Conhecimento (Questões)
    q1Answer?: string;
    q1Score: number;
    q2Answer?: string;
    q2Score: number;
    q3Answer?: string;
    q3Score: number;
    q4Answer?: string;
    q4Score: number;
    q5Answer?: string;
    q5Score: number;
    
    // Habilidade (Prática)
    h1Score: number;
    h2Score: number;
    h3Score: number;
    h4Score: number;
    
    // Atitude (Comportamento)
    a1Score: number;
    a2Score: number;
    a3Score: number;
    a4Score: number;
    
    // Geral
    totalScore: number;
    note?: string;
    employeeNote?: string;
    
    // Novo campo para as respostas de Habilidade e Atitude
    habilidadeData?: any;
    atitudeData?: any;
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

export interface UserAccessLog {
    id: string;
    userId: string;
    username: string;
    loginAt: string;
}

export const trelicaLabels = ['H08 (8m)', 'H12 (12m)', 'H6 (6m)', 'H10 (10m)'];
export const MaterialOptions = ['Fio Máquina', 'CA-60', 'Eletrodos Treliças', 'Sabão', 'Treliça', 'Malha'];

export const DefaultSabaoGauges: Array<{ materialType: MaterialType; gauge: string; productCode: string; description: string }> = [
    { materialType: 'Sabão', gauge: 'Saco 25kg', productCode: '00010', description: 'Condat' },
];

export const DefaultTrelicaGauges: Array<Omit<StockGauge, 'id'> & { id?: string }> = [
    { materialType: 'Treliça', gauge: '12m', productCode: 'H6LE12S', description: 'H-6 LEVE (ESPAÇADOR)', tamanho: '12', superior: '5,4', inferior: '3,2', senozoide: '3,2', peso_final: '5,502', peso_superior: '2,158', peso_senozoide: '1,828', peso_inferior: '1,517' },
    { materialType: 'Treliça', gauge: '12m', productCode: 'H6_12', description: 'H-6', tamanho: '12', superior: '5,6', inferior: '3,8', senozoide: '3,2', peso_final: '6,288', peso_superior: '2,322', peso_senozoide: '1,828', peso_inferior: '2,138' },
    { materialType: 'Treliça', gauge: '6m', productCode: 'H8L6', description: 'H-8 LEVE', tamanho: '6', superior: '5,6', inferior: '3,2', senozoide: '3,2', peso_final: '2,898', peso_superior: '1,161', peso_senozoide: '0,979', peso_inferior: '0,758' },
    { materialType: 'Treliça', gauge: '12m', productCode: 'H8L12', description: 'H-8 LEVE', tamanho: '12', superior: '5,6', inferior: '3,2', senozoide: '3,2', peso_final: '5,797', peso_superior: '2,322', peso_senozoide: '1,958', peso_inferior: '1,517' },
    { materialType: 'Treliça', gauge: '6m', productCode: 'H8M6', description: 'H-8 MÉDIA', tamanho: '6', superior: '5,6', inferior: '3,8', senozoide: '3,2', peso_final: '3,209', peso_superior: '1,161', peso_senozoide: '0,979', peso_inferior: '1,069' },
    { materialType: 'Treliça', gauge: '12m', productCode: 'H8M12', description: 'H-8 MÉDIA', tamanho: '12', superior: '5,6', inferior: '3,8', senozoide: '3,2', peso_final: '6,418', peso_superior: '2,322', peso_senozoide: '1,958', peso_inferior: '2,138' },
    { materialType: 'Treliça', gauge: '6m', productCode: 'H8P6', description: 'H-8 PESADA', tamanho: '6', superior: '6', inferior: '3,8', senozoide: '4,2', peso_final: '4,087', peso_superior: '1,333', peso_senozoide: '1,685', peso_inferior: '1,069' },
    { materialType: 'Treliça', gauge: '12m', productCode: 'H8P12', description: 'H-8 PESADA', tamanho: '12', superior: '6', inferior: '3,8', senozoide: '4,2', peso_final: '8,174', peso_superior: '2,665', peso_senozoide: '3,371', peso_inferior: '2,138' },
    { materialType: 'Treliça', gauge: '6m', productCode: 'H8SP6', description: 'H-8 SUPER PESADO', tamanho: '6', superior: '6', inferior: '4,2', senozoide: '4,2', peso_final: '4,324', peso_superior: '1,333', peso_senozoide: '1,686', peso_inferior: '1,305' },
    { materialType: 'Treliça', gauge: '12m', productCode: 'H8SP12', description: 'H-8 SUPER PESADO', tamanho: '12', superior: '6', inferior: '4,2', senozoide: '4,2', peso_final: '8,647', peso_superior: '2,665', peso_senozoide: '3,371', peso_inferior: '2,611' },
    { materialType: 'Treliça', gauge: '6m', productCode: 'H10L6', description: 'H-10 LEVE', tamanho: '6', superior: '5,8', inferior: '3,8', senozoide: '3,8', peso_final: '3,843', peso_superior: '1,246', peso_senozoide: '1,528', peso_inferior: '1,069' },
    { materialType: 'Treliça', gauge: '12m', productCode: 'H10L12', description: 'H-10 LEVE', tamanho: '12', superior: '5,8', inferior: '3,8', senozoide: '3,8', peso_final: '7,686', peso_superior: '2,491', peso_senozoide: '3,057', peso_inferior: '2,138' },
    { materialType: 'Treliça', gauge: '12m', productCode: 'H10P12', description: 'H-10 PESADA', tamanho: '12', superior: '6', inferior: '4,2', senozoide: '4,2', peso_final: '9,057', peso_superior: '2,665', peso_senozoide: '3,780', peso_inferior: '2,611' },
    { materialType: 'Treliça', gauge: '6m', productCode: 'H12L6', description: 'H-12 LEVE', tamanho: '6', superior: '5,8', inferior: '3,8', senozoide: '3,2', peso_final: '3,522', peso_superior: '1,246', peso_senozoide: '1,207', peso_inferior: '1,069' },
    { materialType: 'Treliça', gauge: '12m', productCode: 'H12L12', description: 'H-12 LEVE', tamanho: '12', superior: '5,8', inferior: '3,8', senozoide: '3,2', peso_final: '7,044', peso_superior: '2,491', peso_senozoide: '2,414', peso_inferior: '2,138' },
    { materialType: 'Treliça', gauge: '6m', productCode: 'H12P6', description: 'H-12 PESADA', tamanho: '6', superior: '6', inferior: '5', senozoide: '4,2', peso_final: '5,270', peso_superior: '1,333', peso_senozoide: '2,086', peso_inferior: '1,852' },
    { materialType: 'Treliça', gauge: '12m', productCode: 'H12P12', description: 'H-12 PESADA', tamanho: '12', superior: '6', inferior: '5', senozoide: '4,2', peso_final: '10,540', peso_superior: '2,665', peso_senozoide: '4,172', peso_inferior: '3,703' },
    { materialType: 'Treliça', gauge: '12m', productCode: 'H16_12', description: 'H-16', tamanho: '12', superior: '6', inferior: '5', senozoide: '4,2', peso_final: '11,263', peso_superior: '2,665', peso_senozoide: '4,894', peso_inferior: '3,703' },
    { materialType: 'Treliça', gauge: '12m', productCode: 'H25_12', description: 'H-25', tamanho: '12', superior: '8', inferior: '6', senozoide: '5', peso_final: '20,042', peso_superior: '4,739', peso_senozoide: '9,973', peso_inferior: '5,330' },
];

export const DefaultElectrodeGauges: Array<{ materialType: MaterialType; gauge: string; productCode: string; description: string }> = [
    { materialType: 'Eletrodos Treliças', gauge: '1000', productCode: '1000', description: 'Eletrodo Superior (D)' },
    { materialType: 'Eletrodos Treliças', gauge: '1001', productCode: '1001', description: 'Eletrodo Superior (E)' },
    { materialType: 'Eletrodos Treliças', gauge: '1002', productCode: '1002', description: 'Base Eletrodo Superior (D)' },
    { materialType: 'Eletrodos Treliças', gauge: '1003', productCode: '1003', description: 'Base Eletrodo Superior (E)' },
    { materialType: 'Eletrodos Treliças', gauge: '1004', productCode: '1004', description: 'Eletrodo Inferior (D)' },
    { materialType: 'Eletrodos Treliças', gauge: '1005', productCode: '1005', description: 'Eletrodo Inferior (E)' },
    { materialType: 'Eletrodos Treliças', gauge: '1006', productCode: '1006', description: 'Base Eletrodo Inferior (D)' },
    { materialType: 'Eletrodos Treliças', gauge: '1007', productCode: '1007', description: 'Base Eletrodo Inferior (E)' },
    { materialType: 'Eletrodos Treliças', gauge: '1008', productCode: '1008', description: 'Eletrodo Central Triangular' },
    { materialType: 'Eletrodos Treliças', gauge: '1009', productCode: '1009', description: 'Base Central Geral' },
    { materialType: 'Eletrodos Treliças', gauge: '1010', productCode: '1010', description: 'Eletrodo da Lateral da Base (D)' },
    { materialType: 'Eletrodos Treliças', gauge: '1011', productCode: '1011', description: 'Eletrodo da Lateral da Base (E)' },
];

export const DefaultMalhaGauges: Array<Omit<StockGauge, 'id'> & { id?: string }> = [
    {
        materialType: 'Malha',
        productCode: '4088',
        description: 'MALHA SOLDADA/IND. LEVE Q 45 - 20X20 3,40MM SOB MEDIDA',
        gauge: '3,40mm',
        longitudinal: '10 peças c/ 3mts',
        transversal: '15 peças c/ 2mts',
        linearMeters: 60,
        meshSpacing: '20X20',
        panelDimensions: '3,00X2,00',
        peso_peca: '4,274',
        peso_final: '4,274'
    },
    {
        materialType: 'Malha',
        productCode: '4089',
        description: 'MALHA SOLDADA/IND. MEDIA Q61 - 15X15 3,40MM SOB MEDIDA',
        gauge: '3,40mm',
        longitudinal: '14 peças c/ 3mts',
        transversal: '20 peças c/ 2mts',
        linearMeters: 79,
        meshSpacing: '15X15',
        panelDimensions: '3,00X2,00',
        peso_peca: '5,627',
        peso_final: '5,627'
    },
    {
        materialType: 'Malha',
        productCode: '3968',
        description: 'MALHA SOLDADA/IND. PAINEL Q113 -2,45 10X10 3,80MM- SOB MEDIDA',
        gauge: '3,80mm',
        longitudinal: '25 peças c/ 6mts',
        transversal: '60 peças c/ 2,45mts',
        linearMeters: 297,
        meshSpacing: '10X10',
        panelDimensions: '6,00X2,45',
        peso_peca: '26,448',
        peso_final: '26,448'
    },
    {
        materialType: 'Malha',
        productCode: '6626',
        description: 'MALHA SOLDADA/IND. PAINEL 6,00X2,45 10X10 4,20MM- SOB MEDIDA',
        gauge: '4,20mm',
        longitudinal: '25 peças c/ 6mts',
        transversal: '60 peças c/ 2,45mts',
        linearMeters: 297,
        meshSpacing: '10X10',
        panelDimensions: '6,00X2,45',
        peso_peca: '32,283',
        peso_final: '32,283'
    },
    {
        materialType: 'Malha',
        productCode: '6621',
        description: 'MALHA SOLDADA/IND. PAINEL 6,00X2,45 10X10 4,60MM- SOB MEDIDA',
        gauge: '4,60mm',
        longitudinal: '25 peças c/ 6mts',
        transversal: '60 peças c/ 2,45mts',
        linearMeters: 297,
        meshSpacing: '10X10',
        panelDimensions: '6,00X2,45',
        peso_peca: '38,725',
        peso_final: '38,725'
    },
    {
        materialType: 'Malha',
        productCode: '3885',
        description: 'MALHA SOLDADA/IND. PAINEL Q116X2,45 10X10 5,00MM- SOB MEDIDA',
        gauge: '5,00mm',
        longitudinal: '25 peças c/ 6mts',
        transversal: '60 peças c/ 2,45mts',
        linearMeters: 297,
        meshSpacing: '10X10',
        panelDimensions: '6,00X2,45',
        peso_peca: '45,753',
        peso_final: '45,753'
    },
    {
        materialType: 'Malha',
        productCode: '6625',
        description: 'MALHA SOLDADA/IND. PAINEL Q238.2,45 10X10 5,50MM- SOB MEDIDA',
        gauge: '5,50mm',
        longitudinal: '25 peças c/ 6mts',
        transversal: '60 peças c/ 2,45mts',
        linearMeters: 297,
        meshSpacing: '10X10',
        panelDimensions: '6,00X2,45',
        peso_peca: '55,361',
        peso_final: '55,361'
    },
    {
        materialType: 'Malha',
        productCode: '4129',
        description: 'MALHA SOLDADA/IND. PAINEL 6,00X2,45 10X10 6,00MM- SOB MEDIDA',
        gauge: '6,00mm',
        longitudinal: '25 peças c/ 6mts',
        transversal: '60 peças c/ 2,45mts',
        linearMeters: 297,
        meshSpacing: '10X10',
        panelDimensions: '6,00X2,45',
        peso_peca: '65,884',
        peso_final: '65,884'
    },
    {
        materialType: 'Malha',
        productCode: '6622',
        description: 'MALHA SOLDADA/IND. PAINEL 6,00X2,45 15X15 3,40MM - SOB MEDIDA',
        gauge: '3,40mm',
        longitudinal: '16 peças c/ 6mts',
        transversal: '40 peças c/ 2,45mts',
        linearMeters: 194,
        meshSpacing: '15X15',
        panelDimensions: '6,00X2,45',
        peso_peca: '13,819',
        peso_final: '13,819'
    }
];

export const FioMaquinaBitolaOptions = ['8.00', '6.50', '6.35', '5.50'];
export const CA60BitolaOptions = ['3.20', '3.40', '3.80', '4.10', '4.20', '4.50', '4.60', '4.90', '5.00', '5.40', '5.60', '5.80', '5.90', '6.00'];
export const TrefilaBitolaOptions = CA60BitolaOptions; // Keeping for compatibility
export const SteelTypeOptions = ['1006', '1008', '1010', '1012', '1015', '1018', 'Outro'];

export const DOWNTIME_THRESHOLDS: Record<string, number> = {
    'Enrosco de fio': 15,
    'Falha no sensor': 10,
    'Quebra fio': 20,
    'Setup': 180,
    'Lubrificação': 10,
    'Limpeza de eletrodos': 15,
    'Limpar eletrodos': 15,
    'Limpeza': 15,
    'Manutenção': 60,
    'Mecanica': 60,
    'Eletrica': 60,
    'Outros': 15,
    'Preparação': 15
};

export interface MachineShiftConfig {
    workStart: string;
    workEnd: string;
    noLunch?: boolean;
    lunchStart?: string;
    lunchEnd?: string;
    shiftCount?: 1 | 2;
    shift2Start?: string;
    shift2End?: string;
    workDays?: number[]; // [1, 2, 3, 4, 5]
    autoStartShift?: boolean;
    autoEndShift?: boolean;
    autoEndTimeoutMin?: number; // padrão: 5 min
    requireManagerAuthForOvertime?: boolean;
}

export interface PcpShiftConfig {
    id: string;
    workStart: string;
    lunchStart: string;
    lunchEnd: string;
    workEnd: string;
    workDays?: number[]; // [1, 2, 3, 4, 5] -> Seg a Sex
    noLunch?: boolean;
    autoStartShift?: boolean;
    autoEndShift?: boolean;
    autoEndTimeoutMin?: number;
    requireManagerAuthForOvertime?: boolean;
    machineConfigs?: Record<string, MachineShiftConfig>;
    updatedAt?: string;
}

export interface PcpHoliday {
    id: string;
    date: string; // 'YYYY-MM-DD'
    description: string;
    createdAt?: string;
}

export type TrelicaStandRoleType = 'superior' | 'senozoide_left' | 'senozoide_right' | 'inferior_left' | 'inferior_right';

export interface TrelicaSpoolStand {
    id: string;
    machine_name: string; // 'Treliça 1' | 'Treliça 2'
    stand_index: number; // 1 to 5
    role_name: string; // 'Banzo Superior (1x)', 'Senoide Lado 1 (1x)', etc.
    role_type: TrelicaStandRoleType;
    current_lot_id?: string | null;
    current_lot_number?: string | null;
    current_gauge?: string | null;
    initial_weight?: number;
    remaining_weight?: number;
    status: 'active' | 'empty' | 'warning' | 'changing';
    last_changed_at?: string;
    last_changed_by?: string;
    updated_at?: string;
}

export interface TrelicaSpoolHistoryEntry {
    id: string;
    machine_name: string; // 'Treliça 1' | 'Treliça 2'
    order_id?: string | null;
    order_number?: string | null;
    trelica_model?: string | null;
    stand_index: number; // 1 a 5
    role_name: string; // 'Banzo Superior (1x)', etc.
    role_type: TrelicaStandRoleType;
    lot_id: string;
    lot_number: string;
    gauge: string;
    start_produced_pieces?: number;
    end_produced_pieces?: number | null;
    pieces_produced: number;
    installed_at: string;
    removed_at?: string | null;
    installed_by?: string | null;
    removed_by?: string | null;
    status: 'active' | 'completed';
    created_at?: string;
}

// ==========================================
// ELETRODOS DE SOLDA DA TRELIÇA (7 POSIÇÕES)
// ==========================================
export type TrelicaElectrodePosition =
    | 'base_sup_esq'
    | 'superior_esq'
    | 'base_sup_dir'
    | 'superior_dir'
    | 'central_triangular'
    | 'base_inf_esq'
    | 'inferior_esq'
    | 'base_inf_dir'
    | 'inferior_dir'
    | 'lateral_esq'
    | 'lateral_dir'
    | 'base_lateral';

export type TrelicaElectrodeType =
    | 'Superior'
    | 'Base Superior'
    | 'Central Triangular'
    | 'Inferior'
    | 'Base Inferior'
    | 'Base'
    | 'Base Lateral'
    | 'Lateral';

export interface TrelicaElectrodeStock {
    id: string;
    lot_number: string;
    type: TrelicaElectrodeType;
    material?: string; // ex: 'CuCrZr (Cobre Cromo Zircônio)' | 'Cobre Berílio'
    quantity: number; // Saldo em estoque (unidades)
    benchmark_lifespan_meters: number; // Ex: 12000 metros (benchmark padrão)
    supplier?: string;
    cost_unit?: number;
    notes?: string;
    status?: 'novo' | 'retificado';
    created_at?: string;
    updated_at?: string;
}

export interface TrelicaMachineElectrode {
    id: string;
    machine_name: string; // 'Treliça 1' | 'Treliça 2'
    position: TrelicaElectrodePosition;
    position_label: string; // 'Superior Esquerdo', etc.
    lot_id?: string | null;
    lot_number?: string | null;
    electrode_type: TrelicaElectrodeType;
    installed_at?: string;
    installed_by?: string;
    meters_produced: number; // Metros de treliça soldados desde instalação
    pieces_produced: number; // Peças de treliça soldadas
    benchmark_meters: number; // Meta de durabilidade
    status: 'active' | 'empty' | 'warning' | 'critical';
    last_dressed_at?: string; // Data da última retífica / dressagem
    dress_count?: number; // Quantidade de vezes que foi retificado
    last_cleaned_at?: string; // Data da última limpeza
    clean_count?: number; // Quantidade de limpezas realizadas
    last_cleaned_by?: string;
    cleaning_type?: string;
    last_adjusted_at?: string; // Data da última regulagem de altura/ângulo
    last_adjusted_by?: string;
    last_adjustment_type?: string; // 'Regulagem de Altura', 'Ajuste de Ângulo', etc.
    last_adjustment_notes?: string;
    updated_at?: string;
}

export interface TrelicaElectrodeHistory {
    id: string;
    machine_name: string;
    position: TrelicaElectrodePosition;
    position_label: string;
    lot_id: string;
    lot_number: string;
    electrode_type: TrelicaElectrodeType;
    installed_at: string;
    removed_at: string;
    installed_by?: string;
    removed_by?: string;
    meters_produced: number;
    pieces_produced: number;
    reason: 'Desgaste Normal' | 'Trinca / Quebra' | 'Queima / Superaquecimento' | 'Envio para Retífica' | 'Troca Preventiva' | 'Ajuste de Setup' | 'Limpeza de Eletrodo' | 'Ajuste de Altura / Ângulo' | string;
    destination?: 'Sucata / Descarte' | 'Retífica / Usinagem' | 'Retorno ao Estoque' | 'Mantido na Máquina';
    notes?: string;
    created_at?: string;
}



