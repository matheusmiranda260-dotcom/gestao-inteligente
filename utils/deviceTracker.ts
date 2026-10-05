/**
 * Utilitário para rastreamento de dispositivos, presença em tempo real e engajamento dos usuários
 */

export const getDeviceId = (): string => {
    try {
        let deviceId = localStorage.getItem('msm_device_uuid');
        if (!deviceId) {
            deviceId = 'dev_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
            localStorage.setItem('msm_device_uuid', deviceId);
        }
        return deviceId;
    } catch {
        return 'dev_unknown_' + Math.random().toString(36).substring(2, 8);
    }
};

export const getDeviceInfo = (): string => {
    try {
        const ua = navigator.userAgent;
        let browser = 'Navegador Web';
        let os = 'Dispositivo';

        // Detecção de Navegador
        if (ua.includes('Edg/')) {
            browser = 'Microsoft Edge';
        } else if (ua.includes('Chrome/') && !ua.includes('Edg/')) {
            browser = 'Google Chrome';
        } else if (ua.includes('Safari/') && !ua.includes('Chrome/')) {
            browser = 'Apple Safari';
        } else if (ua.includes('Firefox/')) {
            browser = 'Mozilla Firefox';
        } else if (ua.includes('OPR/') || ua.includes('Opera/')) {
            browser = 'Opera';
        }

        // Detecção de Sistema Operacional
        if (ua.includes('Windows NT 10.0') || ua.includes('Windows NT 11.0')) {
            os = 'Windows';
        } else if (ua.includes('Macintosh') || ua.includes('Mac OS X')) {
            os = 'macOS';
        } else if (ua.includes('Android')) {
            os = 'Android';
        } else if (ua.includes('iPhone') || ua.includes('iPad')) {
            os = 'iOS';
        } else if (ua.includes('Linux')) {
            os = 'Linux';
        }

        const screenRes = typeof window !== 'undefined' ? `${window.screen?.width || window.innerWidth}x${window.screen?.height || window.innerHeight}` : '';
        const isMobile = /Android|iPhone|iPad|iPod/i.test(ua);

        return `${browser} (${os})${isMobile ? ' [Mobile]' : ''}${screenRes ? ` • ${screenRes}` : ''}`;
    } catch {
        return 'Navegador Web';
    }
};

// Gerenciamento de engajamento do usuário (Ativo, Em 2º Plano, Ocioso)
let lastUserInteractionTime = Date.now();

if (typeof window !== 'undefined') {
    const updateInteraction = () => {
        lastUserInteractionTime = Date.now();
    };

    ['mousemove', 'keydown', 'click', 'scroll', 'touchstart', 'focus', 'wheel'].forEach(event => {
        window.addEventListener(event, updateInteraction, { passive: true });
    });
}

export const getFocusStatus = (): 'active' | 'background' | 'idle' => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return 'background';
    }
    const idleSeconds = (Date.now() - lastUserInteractionTime) / 1000;
    if (idleSeconds > 180) { // Mais de 3 minutos sem interação na tela aberta
        return 'idle';
    }
    return 'active';
};

export const getPageFriendlyName = (page: string): string => {
    const pageNames: Record<string, string> = {
        menu: 'Menu Principal',
        pcpBoard: 'Quadro PCP',
        productionDashboard: 'Dashboard Geral de Produção',
        stock: 'Estoque / Gestão de Lotes',
        stockAdd: 'Conferência de Matéria-Prima',
        stockTransfer: 'Transferência de Lotes',
        trefila: 'Dashboard Trefila',
        trefilaInProgress: 'Painel Trefila em Operação',
        trefilaWeighing: 'Pesagem de Rolos Trefila',
        trefilaBitolaCheck: 'Aferição de Bitola',
        trefilaPending: 'Fila de Produção Trefila',
        trefilaCompleted: 'Histórico de Produção Trefila',
        trefilaReports: 'Relatórios Trefila',
        trefilaParts: 'Peças Trefila',
        trefilaRings: 'Setup de Anéis Trefila',
        productionOrder: 'Criar OP Trefila',
        trelica: 'Dashboard Treliça',
        trelicaInProgress: 'Painel Treliça em Operação',
        trelicaPending: 'Fila de Produção Treliça',
        trelicaCompleted: 'Histórico de Produção Treliça',
        trelicaReports: 'Relatórios Treliça',
        trelicaParts: 'Peças Treliça',
        productionOrderTrelica: 'Criar OP Treliça',
        finishedGoods: 'Estoque Produto Acabado Treliça',
        malha: 'Dashboard Malha',
        malhaInProgress: 'Painel Malha em Operação',
        malhaPending: 'Fila de Produção Malha',
        malhaCompleted: 'Histórico de Produção Malha',
        malhaReports: 'Relatórios Malha',
        productionOrderMalha: 'Criar OP Malha',
        desbobinadeira: 'Desbobinadeira',
        desbobinadeiraDashboard: 'Dashboard Desbobinadeira',
        laboratory: 'Laboratório de Qualidade',
        reports: 'Relatórios e KPIs Estratégicos',
        peopleManagement: 'Gestão de Pessoas',
        meetingsTasks: 'Reuniões e Tarefas',
        continuousImprovement: 'Melhoria Contínua (Kaizen)',
        userManagement: 'Gerenciar Usuários',
        workInstructions: 'Instruções de Trabalho (POP)',
        gaugesManager: 'Configurações de Bitolas',
        partsManager: 'Catálogo de Peças'
    };
    return pageNames[page] || page;
};
