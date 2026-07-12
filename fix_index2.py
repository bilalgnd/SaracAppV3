import os
import re

filepath = 'C:\\\\Users\\\\bilal\\\\SARACAPP\\\\SARACAPPV3\\\\app1\\\\src\\\\main\\\\index.ts'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove duplicate fs import
content = re.sub(r"import \* as fs from 'fs'[\r\n]+import \* as fs from 'fs'", "import * as fs from 'fs'\\nimport express from 'express'", content)

# 2. Fix unused event at line 493
content = content.replace("ipcMain.handle('print-receipt', async (event, adisyon) => {", "ipcMain.handle('print-receipt', async (_event, adisyon) => {")

# 3. Fix the req issue I created:
content = content.replace("expressApp.get('/api/local_logs/download/:filename', (_req, res) => {", "expressApp.get('/api/local_logs/download/:filename', (req, res) => {")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed index.ts")
