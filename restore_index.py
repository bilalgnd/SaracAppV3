import re

with open('C:\\\\Users\\\\bilal\\\\SARACAPP\\\\SARACAPPV3\\\\backs\\\\1107_0330\\\\app1_source.md', 'r', encoding='utf-8') as f:
    content = f.read()

# find index.ts
pattern = r'## File: app1\\src\\main\\index\.ts\n```typescript\n(.*?)```'
match = re.search(pattern, content, re.DOTALL)
if match:
    with open('C:\\\\Users\\\\bilal\\\\SARACAPP\\\\SARACAPPV3\\\\app1\\\\src\\\\main\\\\index.ts', 'w', encoding='utf-8') as f:
        f.write(match.group(1))
    print(f"Extracted {len(match.group(1))} bytes.")
else:
    print("Not found")
