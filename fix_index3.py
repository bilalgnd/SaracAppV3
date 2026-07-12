import os
import re

filepath = 'C:\\\\Users\\\\bilal\\\\SARACAPP\\\\SARACAPPV3\\\\app1\\\\src\\\\main\\\\index.ts'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove duplicate express
content = re.sub(r"import express from 'express'[\r\n]+", "", content, count=1)

# 2. Fix unused event at line 493 (my earlier replace probably missed because of exact match or something)
content = content.replace("ipcMain.handle('print-receipt', async (event, adisyon) => {", "ipcMain.handle('print-receipt', async (_event, adisyon) => {")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed index.ts again")
