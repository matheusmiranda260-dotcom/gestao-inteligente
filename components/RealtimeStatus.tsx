import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

const RealtimeStatus: React.FC = () => {
    const [status, setStatus] = useState<string>('disconnected');
    const [lastError, setLastError] = useState<string | null>(null);

    useEffect(() => {
        const channel = supabase.channel('room-1')
            .on('broadcast', { event: 'test' }, () => console.log('Ping recebido'))
            .subscribe((state, err) => {
                setStatus(state);
                if (err) {
                    setLastError(err.message || JSON.stringify(err));
                    console.error("Realtime Error:", err);
                }
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const getColor = () => {
        switch (status) {
            case 'SUBSCRIBED': return '#00ff00'; // Verde neon
            case 'CHANNEL_ERROR': return '#ff0000'; // Vermelho
            case 'TIMED_OUT': return '#ffa500'; // Laranja
            default: return '#cccccc'; // Cinza
        }
    };

    return (
        <div style={{
            position: 'fixed',
            bottom: '10px',
            right: '10px',
            padding: '10px',
            background: 'rgba(0,0,0,0.8)',
            color: 'white',
            borderRadius: '8px',
            fontSize: '12px',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            gap: '5px'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: getColor(),
                    boxShadow: `0 0 5px ${getColor()}`
                }} />
                <span>Status: {status}</span>
            </div>
            {lastError && (
                <div style={{ color: '#ff6b6b', maxWidth: '200px' }}>
                    Erro: {lastError}
                </div>
            )}
            <div style={{ fontSize: '10px', color: '#aaa', wordBreak: 'break-all' }}>
                URL: {(supabase as any).supabaseUrl}
            </div>
            <div style={{ fontSize: '10px', color: '#aaa' }}>
                (Isso é um diagnóstico)
            </div>
        </div>
    );
};

export default RealtimeStatus;
