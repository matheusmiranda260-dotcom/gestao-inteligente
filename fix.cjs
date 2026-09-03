const fs = require('fs');
let content = fs.readFileSync('components/PeopleManagement.tsx', 'utf8');

const startStr = `                <BlueLabelBox label="MÁQUINAS" />`;
const endStr = `            {/* Employee Selection Overlay */}`;

const startIdx = content.indexOf(startStr);
const endIdx = content.indexOf(endStr);

if (startIdx === -1 || endIdx === -1) {
    console.log("NOT FOUND!");
    console.log("startIdx:", startIdx, "endIdx:", endIdx);
    process.exit(1);
}

const replacement = `{(() => {
                    const admShifts = Object.values(dynamicShifts).filter((s: any) => s.key.startsWith('adm'));
                    if (admShifts.length === 0) return null;
                    
                    const maquinasShifts = admShifts.slice(0, 2);
                    const qualShifts = admShifts.slice(2);

                    return (
                        <div style={{ display: 'flex', width: '100%', gap: 48, alignItems: 'flex-start', justifyContent: 'center' }}>
                            
                            {/* BRANCH 1: MÁQUINAS */}
                            {maquinasShifts.length > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 2 }}>
                                    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                                        <div className="org-hline" style={{ position: 'absolute', top: 0, left: '50%', right: qualShifts.length > 0 ? -24 : '50%', height: 2, background: '#000' }} />
                                        <div className="org-vline" style={{ width: 2, height: 24, background: '#000', zIndex: 1 }} />
                                    </div>
                                    <BlueLabelBox label="MÁQUINAS" />
                                    <VLine />
                                    <div style={{ display: 'flex', width: '100%', gap: 24, alignItems: 'flex-start', justifyContent: 'center' }}>
                                        {maquinasShifts.map((s: any, idx, arr) => {
                                            let hlineStyle: any = { position: 'absolute', top: 0, height: 2, background: '#000' };
                                            if (arr.length === 1) hlineStyle = { display: 'none' };
                                            else if (idx === 0) hlineStyle = { left: '50%', right: -12, ...hlineStyle };
                                            else hlineStyle = { left: -12, right: '50%', ...hlineStyle };
                                            
                                            return (
                                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }} key={s.key}>
                                                    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                                                        <div className="org-hline" style={hlineStyle} />
                                                        <div className="org-vline" style={{ width: 2, height: 24, background: '#000', zIndex: 1 }} />
                                                    </div>
                                                    {card(s, 'ADMINISTRAÇÃO')}
                                                    
                                                    {idx === 0 && (
                                                        <>
                                                            <div style={{ width: 2, height: 24, background: '#000' }} />
                                                            <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', justifyContent: 'center' }}>
                                                                <div style={col}>
                                                                    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                                                                        <div className="org-hline" style={{ position: 'absolute', top: 0, left: '50%', right: -12, height: 2, background: '#000' }} />
                                                                        <div className="org-vline" style={{ width: 2, height: 24, background: '#000', zIndex: 1 }} />
                                                                    </div>
                                                                    <BlueLabelBox label="TREFILA 1" />
                                                                    <button onClick={() => handleAddShift('tr1')} className="no-print" style={{ marginTop: 8, marginBottom: 8, fontSize: 10, fontWeight: 'bold', color: '#16a34a', background: '#f0fdf4', border: '1px solid #16a34a', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}>+ Novo Turno</button>
                                                                    <VLine />
                                                                    {Object.values(dynamicShifts).filter((ms: any) => ms.key.startsWith('tr1')).map((ms: any, midx, marr) => (
                                                                        <React.Fragment key={ms.key}>
                                                                            {card(ms, 'TREFILA 1')}
                                                                            {midx < marr.length - 1 && <VLine />}
                                                                        </React.Fragment>
                                                                    ))}
                                                                </div>
                                                                
                                                                <div style={col}>
                                                                    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                                                                        <div className="org-hline" style={{ position: 'absolute', top: 0, left: -12, right: '50%', height: 2, background: '#000' }} />
                                                                        <div className="org-vline" style={{ width: 2, height: 24, background: '#000', zIndex: 1 }} />
                                                                    </div>
                                                                    <BlueLabelBox label="MALHA" />
                                                                    <button onClick={() => handleAddShift('malha')} className="no-print" style={{ marginTop: 8, marginBottom: 8, fontSize: 10, fontWeight: 'bold', color: '#16a34a', background: '#f0fdf4', border: '1px solid #16a34a', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}>+ Novo Turno</button>
                                                                    <VLine />
                                                                    {Object.values(dynamicShifts).filter((ms: any) => ms.key.startsWith('malha')).map((ms: any, midx, marr) => (
                                                                        <React.Fragment key={ms.key}>
                                                                            {card(ms, 'MALHA')}
                                                                            {midx < marr.length - 1 && <VLine />}
                                                                        </React.Fragment>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </>
                                                    )}

                                                    {idx === 1 && (
                                                        <>
                                                            <div style={{ width: 2, height: 24, background: '#000' }} />
                                                            <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', justifyContent: 'center' }}>
                                                                <div style={col}>
                                                                    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                                                                        <div className="org-hline" style={{ position: 'absolute', top: 0, left: '50%', right: -12, height: 2, background: '#000' }} />
                                                                        <div className="org-vline" style={{ width: 2, height: 24, background: '#000', zIndex: 1 }} />
                                                                    </div>
                                                                    <BlueLabelBox label="TRELIÇA 1" />
                                                                    <button onClick={() => handleAddShift('tc1')} className="no-print" style={{ marginTop: 8, marginBottom: 8, fontSize: 10, fontWeight: 'bold', color: '#16a34a', background: '#f0fdf4', border: '1px solid #16a34a', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}>+ Novo Turno</button>
                                                                    <VLine />
                                                                    {Object.values(dynamicShifts).filter((ms: any) => ms.key.startsWith('tc1')).map((ms: any, midx, marr) => (
                                                                        <React.Fragment key={ms.key}>
                                                                            {card(ms, 'TRELIÇA 1')}
                                                                            {midx < marr.length - 1 && <VLine />}
                                                                        </React.Fragment>
                                                                    ))}
                                                                </div>
                                                                
                                                                <div style={col}>
                                                                    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                                                                        <div className="org-hline" style={{ position: 'absolute', top: 0, left: -12, right: '50%', height: 2, background: '#000' }} />
                                                                        <div className="org-vline" style={{ width: 2, height: 24, background: '#000', zIndex: 1 }} />
                                                                    </div>
                                                                    <BlueLabelBox label="TRELIÇA 2" />
                                                                    <button onClick={() => handleAddShift('tc2')} className="no-print" style={{ marginTop: 8, marginBottom: 8, fontSize: 10, fontWeight: 'bold', color: '#16a34a', background: '#f0fdf4', border: '1px solid #16a34a', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}>+ Novo Turno</button>
                                                                    <VLine />
                                                                    {Object.values(dynamicShifts).filter((ms: any) => ms.key.startsWith('tc2')).map((ms: any, midx, marr) => (
                                                                        <React.Fragment key={ms.key}>
                                                                            {card(ms, 'TRELIÇA 2')}
                                                                            {midx < marr.length - 1 && <VLine />}
                                                                        </React.Fragment>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* BRANCH 2: QUALIDADE */}
                            {qualShifts.length > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                                    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                                        <div className="org-hline" style={{ position: 'absolute', top: 0, left: -24, right: '50%', height: 2, background: '#000' }} />
                                        <div className="org-vline" style={{ width: 2, height: 24, background: '#000', zIndex: 1 }} />
                                    </div>
                                    <BlueLabelBox label="SISTEMA DE QUALIDADE" />
                                    <VLine />
                                    <div style={{ display: 'flex', width: '100%', gap: 24, alignItems: 'flex-start', justifyContent: 'center' }}>
                                        {qualShifts.map((s: any, idx, arr) => {
                                            let hlineStyle: any = { position: 'absolute', top: 0, height: 2, background: '#000' };
                                            if (arr.length === 1) hlineStyle = { display: 'none' };
                                            else if (idx === 0) hlineStyle = { left: '50%', right: -12, ...hlineStyle };
                                            else if (idx === arr.length - 1) hlineStyle = { left: -12, right: '50%', ...hlineStyle };
                                            else hlineStyle = { left: -12, right: -12, ...hlineStyle };
                                            
                                            return (
                                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }} key={s.key}>
                                                    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                                                        <div className="org-hline" style={hlineStyle} />
                                                        <div className="org-vline" style={{ width: 2, height: 24, background: '#000', zIndex: 1 }} />
                                                    </div>
                                                    {card(s, 'ADMINISTRAÇÃO')}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                        </div>
                    );
                })()}
`;

const finalContent = content.substring(0, startIdx) + replacement + content.substring(endIdx);
fs.writeFileSync('components/PeopleManagement.tsx', finalContent);
console.log("SUCCESS");
