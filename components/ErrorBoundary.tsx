import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, errorInfo: null };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error caught by ErrorBoundary:", error, errorInfo);
        this.setState({ errorInfo });
        try {
            localStorage.setItem('msm_last_crash', JSON.stringify({
                message: error.message,
                name: error.name,
                stack: error.stack,
                componentStack: errorInfo.componentStack,
                time: new Date().toISOString()
            }));
        } catch (_) {}
    }

    private handleReload = () => {
        window.location.reload();
    };

    private handleClearAndReload = () => {
        try {
            localStorage.removeItem('msm_user');
            localStorage.removeItem('pcp_daily_shift_config');
            localStorage.removeItem('cached_trelica_models');
            localStorage.removeItem('fechamento_op_report_draft');
        } catch (_) {}
        window.location.href = '/';
    };

    private handleCopyError = () => {
        const details = `Erro: ${this.state.error?.message}\n\nStack: ${this.state.error?.stack}\n\nComponent Stack: ${this.state.errorInfo?.componentStack}`;
        navigator.clipboard.writeText(details);
        alert('Diagnóstico copiado para a área de transferência!');
    };

    public render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    minHeight: '100vh',
                    width: '100vw',
                    backgroundColor: '#030B14',
                    color: '#F1F5F9',
                    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '24px',
                    boxSizing: 'border-box'
                }}>
                    <div style={{
                        maxWidth: '720px',
                        width: '100%',
                        backgroundColor: '#091828',
                        border: '1px solid #1E3A5F',
                        borderRadius: '20px',
                        padding: '32px',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                            <div style={{
                                width: '52px',
                                height: '52px',
                                borderRadius: '16px',
                                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '26px'
                            }}>
                                ⚠️
                            </div>
                            <div>
                                <h1 style={{ fontSize: '20px', fontWeight: '800', margin: 0, color: '#FFFFFF', letterSpacing: '-0.02em' }}>
                                    Recuperação do Sistema MSM
                                </h1>
                                <p style={{ fontSize: '13px', color: '#94A3B8', margin: '4px 0 0 0' }}>
                                    Ocorreu uma falha inesperada durante a renderização da tela.
                                </p>
                            </div>
                        </div>

                        <div style={{
                            backgroundColor: '#040C16',
                            border: '1px solid #142842',
                            borderRadius: '12px',
                            padding: '16px',
                            marginBottom: '24px',
                            maxHeight: '260px',
                            overflowY: 'auto'
                        }}>
                            <div style={{ fontSize: '13px', fontWeight: '700', color: '#F87171', marginBottom: '8px' }}>
                                {this.state.error?.name}: {this.state.error?.message}
                            </div>
                            {this.state.error?.stack && (
                                <pre style={{
                                    fontSize: '11px',
                                    color: '#64748B',
                                    fontFamily: 'monospace',
                                    margin: 0,
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-all'
                                }}>
                                    {this.state.error.stack}
                                </pre>
                            )}
                        </div>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'flex-end' }}>
                            <button
                                onClick={this.handleCopyError}
                                style={{
                                    padding: '10px 18px',
                                    borderRadius: '10px',
                                    border: '1px solid #1E3A5F',
                                    backgroundColor: 'transparent',
                                    color: '#38BDF8',
                                    fontSize: '13px',
                                    fontWeight: '700',
                                    cursor: 'pointer'
                                }}
                            >
                                📋 Copiar Detalhes
                            </button>
                            <button
                                onClick={this.handleClearAndReload}
                                style={{
                                    padding: '10px 18px',
                                    borderRadius: '10px',
                                    border: '1px solid #DC2626',
                                    backgroundColor: 'rgba(220, 38, 38, 0.1)',
                                    color: '#F87171',
                                    fontSize: '13px',
                                    fontWeight: '700',
                                    cursor: 'pointer'
                                }}
                            >
                                🧹 Limpar Sessão e Entrar
                            </button>
                            <button
                                onClick={this.handleReload}
                                style={{
                                    padding: '10px 22px',
                                    borderRadius: '10px',
                                    border: 'none',
                                    backgroundColor: '#0284C7',
                                    color: '#FFFFFF',
                                    fontSize: '13px',
                                    fontWeight: '800',
                                    cursor: 'pointer'
                                }}
                            >
                                🔄 Recarregar
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
