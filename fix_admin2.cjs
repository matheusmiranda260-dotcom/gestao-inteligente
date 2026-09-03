const fs = require('fs');
let content = fs.readFileSync('components/PeopleManagement.tsx', 'utf8');

const target1 = `                <BlueLabelBox label="ADMINISTRAÇÃO" />
                <button onClick={() => handleAddShift('adm')} className="no-print" style={{ marginTop: 8, marginBottom: 8, fontSize: 12, fontWeight: 'bold', color: '#16a34a', background: '#f0fdf4', border: '1px solid #16a34a', borderRadius: 4, padding: '4px 12px', cursor: 'pointer' }}>+ Novo Turno</button>
                <VLine />
{(() => {
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
                                    <div style={{ display: 'flex', width: '100%', gap: 24, alignItems: 'flex-start', justifyContent: 'center' }}>`;


const replacement1 = `{(() => {
                    const admShifts = Object.values(dynamicShifts).filter((s: any) => s.key.startsWith('adm'));
                    
                    const maquinasShifts = admShifts.slice(0, 2);
                    const qualShifts = admShifts.slice(2);

                    return (
                        <div style={{ display: 'flex', width: '100%', gap: 48, alignItems: 'flex-start', justifyContent: 'center' }}>
                            
                            {/* BRANCH 1: MÁQUINAS */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 2 }}>
                                <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                                    <div className="org-hline" style={{ position: 'absolute', top: 0, left: '50%', right: -24, height: 2, background: '#000' }} />
                                    <div className="org-vline" style={{ width: 2, height: 24, background: '#000', zIndex: 1 }} />
                                </div>
                                <BlueLabelBox label="MÁQUINAS" />
                                <button onClick={() => handleAddShift('adm')} className="no-print" style={{ marginTop: 8, marginBottom: 8, fontSize: 10, fontWeight: 'bold', color: '#16a34a', background: '#f0fdf4', border: '1px solid #16a34a', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}>+ Novo Turno</button>
                                {maquinasShifts.length > 0 && <VLine />}
                                
                                {maquinasShifts.length > 0 && (
                                    <div style={{ display: 'flex', width: '100%', gap: 24, alignItems: 'flex-start', justifyContent: 'center' }}>`;

content = content.replace(target1, replacement1);


// target2 covers the end of MÁQUINAS and the start of QUALIDADE
const target2 = `                                    </div>
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
                                    <div style={{ display: 'flex', width: '100%', gap: 24, alignItems: 'flex-start', justifyContent: 'center' }}>`;

const replacement2 = `                                    </div>
                                )}
                            </div>

                            {/* BRANCH 2: QUALIDADE */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                                <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                                    <div className="org-hline" style={{ position: 'absolute', top: 0, left: -24, right: '50%', height: 2, background: '#000' }} />
                                    <div className="org-vline" style={{ width: 2, height: 24, background: '#000', zIndex: 1 }} />
                                </div>
                                <BlueLabelBox label="SISTEMA DE QUALIDADE" />
                                <button onClick={() => handleAddShift('adm')} className="no-print" style={{ marginTop: 8, marginBottom: 8, fontSize: 10, fontWeight: 'bold', color: '#16a34a', background: '#f0fdf4', border: '1px solid #16a34a', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}>+ Novo Turno</button>
                                {qualShifts.length > 0 && <VLine />}
                                
                                {qualShifts.length > 0 && (
                                    <div style={{ display: 'flex', width: '100%', gap: 24, alignItems: 'flex-start', justifyContent: 'center' }}>`;

content = content.replace(target2, replacement2);

// target3 covers the end of QUALIDADE
const target3 = `                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                        </div>`;

const replacement3 = `                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                        </div>`;

content = content.replace(target3, replacement3);

fs.writeFileSync('components/PeopleManagement.tsx', content);
console.log("REPLACED SUCCESSFULLY!");
