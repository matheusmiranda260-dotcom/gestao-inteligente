const fs = require('fs');
let content = fs.readFileSync('components/PeopleManagement.tsx', 'utf8');

content = content.replace(
    'width: 1240px !important;\r\n                    max-width: 1240px !important;',
    'width: max-content !important;\r\n                    min-width: 1240px !important;\r\n                    max-width: max-content !important;'
);

content = content.replace(
    'width: 1240px !important;\n                    max-width: 1240px !important;',
    'width: max-content !important;\n                    min-width: 1240px !important;\n                    max-width: max-content !important;'
);

content = content.replace(
    '<div id="org-chart-sheet" className="max-w-[1240px] mx-auto bg-white border-2 border-[#002060] rounded-xl shadow-lg p-6 org-sheet-container relative">',
    '<div id="org-chart-sheet" className="w-max min-w-[1240px] mx-auto bg-white border-2 border-[#002060] rounded-xl shadow-lg p-6 org-sheet-container relative">'
);

fs.writeFileSync('components/PeopleManagement.tsx', content);
console.log("Replaced successfully!");
