function Update-HtmlFile {
    param([string]$FilePath)
    $html = Get-Content -Path $FilePath -Raw

    # Define the new button and script
    $newButtonHtml = '<div style="position: fixed; top: 20px; right: 20px; z-index: 999999;"><button onclick="printTestPdf()" style="background: red; color: white; padding: 15px 30px; font-size: 20px; border-radius: 10px; cursor: pointer; border: 2px solid white; font-weight: bold; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">TEST FISI YAZDIR</button></div>
<script>
function printTestPdf() {
    let iframe = document.getElementById("pdf-iframe");
    if (!iframe) {
        iframe = document.createElement("iframe");
        iframe.id = "pdf-iframe";
        iframe.style.position = "absolute";
        iframe.style.width = "0";
        iframe.style.height = "0";
        iframe.style.border = "none";
        iframe.src = "fis.pdf";
        document.body.appendChild(iframe);
        iframe.onload = function() {
            setTimeout(function() { iframe.contentWindow.print(); }, 500);
        };
    } else {
        iframe.contentWindow.print();
    }
}
</script>'

    # Remove old button divs
    $html = $html -replace '<div style="position: fixed; top: 20px; right: 20px; z-index: 999999;">.*?</div>', ''
    
    # Remove old scripts if any (just in case I added them before)
    $html = $html -replace '<script>[\s\S]*?printTestPdf[\s\S]*?</script>', ''

    # Insert new button before </body>
    $html = $html -replace '</body>', ("$newButtonHtml
</body>")

    Set-Content -Path $FilePath -Value $html
}

Update-HtmlFile "C:\Users\bilal\SARACAPP\SARACAPPV3\server\public\trendyol-mock\TGO Yemek.html"
Update-HtmlFile "C:\Users\bilal\SARACAPP\SARACAPPV3\server\public\trendyol-mock\2TGO Yemek.html"
