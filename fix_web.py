import os

filepath = 'C:\\\\Users\\\\bilal\\\\SARACAPP\\\\SARACAPPV3\\\\app1\\\\src\\\\renderer\\\\src\\\\components\\\\OcrProcessor.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Fix unused filePath
content = content.replace("const parseAndSaveOrder = (text: string, filePath: string) => {", "const parseAndSaveOrder = (text: string, _filePath?: string) => {")

# 2. Fix missing time in newOrder
content = content.replace("createdAt: new Date().toISOString(),", "createdAt: new Date().toISOString(),\\n      time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed OcrProcessor.tsx")
