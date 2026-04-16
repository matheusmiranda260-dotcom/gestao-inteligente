const fs = require('fs');
let content = fs.readFileSync('components/MachineControl.tsx', 'utf8');

// Fix useMemo dependencies
content = content.replace(/\]\,\s*\[\s*productionOrders\,\s*machineType\s*\]\)/g, "], [productionOrders, activeMachine])");
content = content.replace(/\]\,\s*\[\s*machineType\s*\]\)/g, "], [activeMachine])");

// Fix shiftProducedTotal logic which used machineType instead of activeMachine
content = content.replace(/order\.machine \!== machineType/g, "order.machine !== activeMachine");

fs.writeFileSync('components/MachineControl.tsx', content, 'utf8');
