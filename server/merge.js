const fs = require('fs');

const oldHtml = fs.readFileSync('old_admintools_utf8.html', 'utf8');
const newHtml = fs.readFileSync('public/templates/admintools.html', 'utf8');

// Extract styles from newHtml
const styleMatch = newHtml.match(/<style>([\s\S]*?)<\/style>/);
let newStyles = '';
if (styleMatch) {
    newStyles = styleMatch[1];
    // Remove body styles as old one has its own
    newStyles = newStyles.replace(/body\s*\{[\s\S]*?\}/, '');
}

// Extract terminal html from newHtml
const headerMatch = newHtml.match(/<div class="header">([\s\S]*?)<\/div>\s*<\/div>/); // wait, header closes with one div, but filters might close it
const terminalHtml = `
    <!-- Terminal Section -->
    <div class="glass-panel rounded-2xl flex flex-col shadow-lg mt-6 h-[400px]">
        <div class="p-4 border-b border-gray-800 flex justify-between items-center bg-black/40 rounded-t-2xl">
            <div class="title font-bold text-[#58a6ff]" style="text-shadow: 0 0 5px rgba(88, 166, 255, 0.5);">_ SARACAPP / SYSTEM_TERMINAL</div>
            <div class="filters flex gap-4" style="background: #161b22; padding: 5px 15px; border-radius: 8px; border: 1px solid #30363d;">
                <label class="filter-label flex items-center gap-2 cursor-pointer text-[#c9d1d9] text-sm">
                    <input type="checkbox" id="filterApp1" checked onchange="renderLogs()" class="terminal-checkbox"> App1 (Kasa)
                </label>
                <label class="filter-label flex items-center gap-2 cursor-pointer text-[#c9d1d9] text-sm">
                    <input type="checkbox" id="filterApp2" checked onchange="renderLogs()" class="terminal-checkbox"> App2 (Mobil)
                </label>
                <label class="filter-label flex items-center gap-2 cursor-pointer text-[#c9d1d9] text-sm">
                    <input type="checkbox" id="filterServer" checked onchange="renderLogs()" class="terminal-checkbox"> Server
                </label>
            </div>
        </div>
        <div class="terminal-box flex-1 p-4 overflow-y-auto text-sm font-mono" id="terminal" style="background-color: #010409; box-shadow: inset 0 0 10px rgba(0,0,0,0.8); border-radius: 0 0 16px 16px;"></div>
    </div>
`;

// Extract scripts
const scriptMatch = newHtml.match(/<script>([\s\S]*?)<\/script>/);
let newScript = '';
if (scriptMatch) {
    newScript = scriptMatch[1];
    // Remove checkPassword logic from newScript because oldHtml already has login() logic!
    newScript = newScript.replace(/let adminPassword[\s\S]*?function connectWS/m, 'function connectWS');
}

// Inject styles
let merged = oldHtml.replace('</style>', newStyles + `
        .terminal-checkbox {
            appearance: none; width: 36px; height: 20px; background-color: #21262d; border-radius: 20px; position: relative; cursor: pointer; outline: none; border: 1px solid #30363d; transition: background-color 0.3s, border-color 0.3s; margin: 0; display: inline-block;
        }
        .terminal-checkbox::after { content: ''; position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; background-color: #8b949e; border-radius: 50%; transition: transform 0.3s, background-color 0.3s; }
        .terminal-checkbox:checked { background-color: #238636; border-color: #2ea043; }
        .terminal-checkbox:checked::after { transform: translateX(16px); background-color: #ffffff; }
        .log-entry { display: flex; gap: 10px; margin-bottom: 4px; }
        .log-time { color: #8b949e; min-width: 80px; }
        .log-source { font-weight: bold; min-width: 80px; }
        .log-message { flex: 1; word-break: break-all; }
        .source-App1 { color: #ff7b72; }
        .source-App2 { color: #79c0ff; }
        .source-Server { color: #d2a8ff; }
        .type-success { color: #3fb950; }
        .type-error { color: #f85149; font-weight: bold; background: rgba(248, 81, 73, 0.1); }
        .type-warning { color: #d29922; }
        .type-info { color: #8b949e; }
        .terminal-box::-webkit-scrollbar { width: 8px; }
        .terminal-box::-webkit-scrollbar-track { background: #010409; }
        .terminal-box::-webkit-scrollbar-thumb { background: #30363d; border-radius: 4px; }
        .terminal-box::-webkit-scrollbar-thumb:hover { background: #8b949e; }
</style>`);

// In oldHtml, dashboardScreen height is set to h-[90vh], change to h-auto min-h-[90vh] so it can expand
merged = merged.replace('h-[90vh]', 'h-auto min-h-[90vh] pb-10');

// Inject terminalHtml before the closing div of dashboardScreen
merged = merged.replace(/<\/div>\s*<\/div>\s*<script>/, `</div>\n${terminalHtml}\n  </div>\n\n  <script>`);

// Inject script
// In oldHtml, there's `showDashboard()` function. I'll modify it to also call `connectWS()`
merged = merged.replace(/function showDashboard\(\) \{[\s\S]*?\}/, `function showDashboard() {\n      document.getElementById('loginScreen').classList.add('hidden');\n      document.getElementById('dashboardScreen').classList.remove('hidden');\n      fetchUsers();\n      if(!ws || ws.readyState !== WebSocket.OPEN) connectWS();\n    }`);

// oldHtml already has a `logout()` function. I'll close WS if logged out.
merged = merged.replace(/function logout\(\) \{[\s\S]*?\}/, `function logout() {\n      adminToken = '';\n      localStorage.removeItem('adminToken');\n      document.getElementById('dashboardScreen').classList.add('hidden');\n      document.getElementById('loginScreen').classList.remove('hidden');\n      document.getElementById('passwordInput').value = '';\n      if(ws) { ws.onclose = null; ws.close(); ws = null; }\n    }`);

merged = merged.replace('// Init\n    if (adminToken) {', newScript + '\n    // Init\n    if (adminToken) {');

fs.writeFileSync('public/templates/admintools.html', merged);
