const fs = require('fs');
const fixFile = (file) => {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/machineType === 'Trefila'/g, "activeMachine.startsWith('Trefila')");
    content = content.replace(/machineType !== 'Trefila'/g, "(!activeMachine.startsWith('Trefila'))");
    content = content.replace(/machineType === 'Treliça'/g, "activeMachine.startsWith('Treliça')");
    content = content.replace(/machineType !== 'Treliça'/g, "(!activeMachine.startsWith('Treliça'))");
    content = content.replace(/o\.machine === machineType/g, "(o.machine === activeMachine || (activeMachine === 'Trefila 1' && o.machine === 'Trefila') || (activeMachine === 'Treliça 1' && o.machine === 'Treliça'))");
    content = content.replace(/r\.machine === machineType/g, "(r.machine === activeMachine || (activeMachine === 'Trefila 1' && r.machine === 'Trefila') || (activeMachine === 'Treliça 1' && r.machine === 'Treliça'))");
    content = content.replace(/machine: machineType/g, "machine: activeMachine");
    fs.writeFileSync(file, content, 'utf8');
};
fixFile('components/MachineControl.tsx');
