const fs = require('fs');
let content = fs.readFileSync('App.tsx', 'utf8');
content = content.replace(/r\.machine === 'Trefila'/g, "r.machine.startsWith('Trefila')");
content = content.replace(/r\.machine === 'Treliça'/g, "r.machine.startsWith('Treliça')");
content = content.replace(/savedOrder\.machine === 'Trefila'/g, "savedOrder.machine.startsWith('Trefila')");
content = content.replace(/savedOrder\.machine === 'Treliça'/g, "savedOrder.machine.startsWith('Treliça')");
content = content.replace(/orderToDelete\.machine === 'Treliça'/g, "orderToDelete.machine.startsWith('Treliça')");
content = content.replace(/orderToCancel\.machine === 'Trefila'/g, "orderToCancel.machine.startsWith('Trefila')");
content = content.replace(/orderToCancel\.machine === 'Treliça'/g, "orderToCancel.machine.startsWith('Treliça')");
content = content.replace(/order\.machine === 'Trefila'/g, "order.machine.startsWith('Trefila')");
content = content.replace(/order\.machine === 'Treliça'/g, "order.machine.startsWith('Treliça')");
content = content.replace(/order\.machine \!== 'Trefila'/g, "(!order.machine.startsWith('Trefila'))");

fs.writeFileSync('App.tsx', content, 'utf8');
