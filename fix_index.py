import os

filepath = 'C:\\\\Users\\\\bilal\\\\SARACAPP\\\\SARACAPPV3\\\\app1\\\\src\\\\main\\\\index.ts'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove duplicate fs import
content = content.replace("import * as fs from 'fs'\\nimport * as fs from 'fs'", "import * as fs from 'fs'\\nimport express from 'express'")

# 2. Fix unused req at line 126
content = content.replace("expressApp.use((req, res, next) => {", "expressApp.use((_req, res, next) => {")

# 3. Fix unused req at line 131 (or similar)
content = content.replace("expressApp.get('/api/local_logs', (req, res) => {", "expressApp.get('/api/local_logs', (_req, res) => {")

# 4. Fix unused req at line 146 (or similar)
content = content.replace("expressApp.get('/api/local_logs/download/:filename', (req, res) => {", "expressApp.get('/api/local_logs/download/:filename', (_req, res) => {")

# 5. Fix unused event at line 493
content = content.replace("ipcMain.handle('print-receipt', async (event, adisyon) => {", "ipcMain.handle('print-receipt', async (_event, adisyon) => {")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed index.ts")
