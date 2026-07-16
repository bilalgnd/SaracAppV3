import re
with open(r'c:\Users\bilal\SARACAPP\SARACAPPV3\server\public\trendyol-mock\TGO Yemek.html', 'r', encoding='utf-8') as f:
    content = f.read()

new_script = '''      let iframe = document.getElementById("pdf-iframe");
      if (iframe) iframe.remove();
      iframe = document.createElement("iframe");
      iframe.id = "pdf-iframe";
      iframe.style.position = "absolute";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "none";
      iframe.src = pdfUrl;
      document.body.appendChild(iframe);
      iframe.onload = function() {
          iframe.contentWindow.print();
          window.triggerPdfExtraction = temp;
      };
  }
  </script>
</body></html>'''

content = re.sub(r'let iframe = document\.getElementById\(\"pdf-iframe\"\);.*', new_script, content, flags=re.DOTALL)

with open(r'c:\Users\bilal\SARACAPP\SARACAPPV3\server\public\trendyol-mock\TGO Yemek.html', 'w', encoding='utf-8') as f:
    f.write(content)
