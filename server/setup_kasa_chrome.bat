@echo off
setlocal EnableDelayedExpansion
color 0A
echo ===================================================
echo   SARAÇ APP - KASA CHROME KURULUM SCRIPT'I
echo ===================================================
echo.
echo Bu islem masaustune ozel bir "Kasa Chrome" kisayolu olusturur.
echo Eger ilk kez kuruluyorsa mevcut Chrome profilinizi kopyalar (Bu islem biraz surebilir).
echo.
echo Devam etmek icin klavyeden herhangi bir tusa basin...
pause >nul

echo.
set "KASA_PROFILE=C:\KasaChrome"

echo [1/3] Cakisabilecek acik Chrome pencereleri kapatiliyor...
taskkill /F /IM chrome.exe /T >nul 2>&1
timeout /t 2 /nobreak >nul

:: Kopyalama isini arka planda yapacak gecici scripti hazirla
echo @echo off > "%TEMP%\kasa_copy_script.bat"
echo robocopy "%%LOCALAPPDATA%%\Google\Chrome\User Data" "%KASA_PROFILE%" /E /XD Cache "Code Cache" "Media Cache" DawnCache GPUCache /R:0 /W:0 /NFL /NDL /NJH /NJS ^>nul 2^>^&1 >> "%TEMP%\kasa_copy_script.bat"
echo echo done ^> "%TEMP%\kasa_copy_done.tmp" >> "%TEMP%\kasa_copy_script.bat"
echo exit >> "%TEMP%\kasa_copy_script.bat"

if exist "%KASA_PROFILE%" (
    echo.
    echo [2/3] "C:\KasaChrome" klasoru zaten var. ^(Daha once acilmis bos bir Chrome olabilir^)
    set /p COPY_CONFIRM="Mevcut Chrome verileriniz (oturumlar, cerezler) buraya kopyalansin mi? (E/H): "
    if /I "!COPY_CONFIRM!"=="E" (
        echo.
        echo Lutfen bekleyin, Chrome profiliniz kopyalaniyor...
        echo ^(Bu islem dosya boyutunuza gore 1-2 dakika surebilir^)
        echo.
        <nul set /p "=Ilerleme: "
        
        del /f /q "%TEMP%\kasa_copy_done.tmp" 2>nul
        start /b cmd /c "%TEMP%\kasa_copy_script.bat"
        
        :wait_copy_1
        if not exist "%TEMP%\kasa_copy_done.tmp" (
            <nul set /p "=#"
            timeout /t 1 /nobreak >nul
            goto wait_copy_1
        )
        del /f /q "%TEMP%\kasa_copy_done.tmp" 2>nul
        
        echo.
        echo.
        echo Profil kopyalama tamamlandi!
    ) else (
        echo Kopyalama adimi atlandi.
    )
) else (
    echo.
    echo [2/3] Mevcut Chrome profiliniz kopyalaniyor...
    echo Lutfen bekleyin, arka planda kopyalaniyor...
    echo ^(Bu islem dosya boyutunuza gore 1-2 dakika surebilir^)
    echo.
    <nul set /p "=Ilerleme: "
    
    mkdir "%KASA_PROFILE%"
    
    del /f /q "%TEMP%\kasa_copy_done.tmp" 2>nul
    start /b cmd /c "%TEMP%\kasa_copy_script.bat"
    
    :wait_copy_2
    if not exist "%TEMP%\kasa_copy_done.tmp" (
        <nul set /p "=#"
        timeout /t 1 /nobreak >nul
        goto wait_copy_2
    )
    del /f /q "%TEMP%\kasa_copy_done.tmp" 2>nul
    
    echo.
    echo.
    echo Profil kopyalama tamamlandi!
)

:: Gecici dosyalari temizle
del /f /q "%TEMP%\kasa_copy_script.bat" 2>nul

echo.
echo [3/3] Masaustune "Kasa Chrome" kisayolu olusturuluyor...
set "TARGET_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe"
if not exist "%TARGET_PATH%" (
    set "TARGET_PATH=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
)

:: VBScript ile OneDrive vb. baglantili gercek Masaustu yolunu bul ve kisayolu olustur
echo Set oWS = WScript.CreateObject("WScript.Shell") > CreateShortcut.vbs
echo sLinkFile = oWS.SpecialFolders("Desktop") ^& "\Kasa Chrome.lnk" >> CreateShortcut.vbs
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> CreateShortcut.vbs
echo oLink.TargetPath = "%TARGET_PATH%" >> CreateShortcut.vbs
echo oLink.Arguments = "--remote-debugging-port=9222 --user-data-dir=" ^& Chr(34) ^& "C:\KasaChrome" ^& Chr(34) >> CreateShortcut.vbs
echo oLink.Description = "Sarac App Siparis Dinleyici Chrome" >> CreateShortcut.vbs
echo oLink.Save >> CreateShortcut.vbs

cscript /nologo CreateShortcut.vbs >nul 2>&1
del CreateShortcut.vbs

echo.
echo ===================================================
echo   KURULUM BASARIYLA TAMAMLANDI!
echo ===================================================
echo Masaustunuzde "Kasa Chrome" adinda yeni bir kisayol olusturuldu.
echo Artik dukkan sistemini kullanirken YALNIZCA bu kisayolu kullanin.
echo Cikmak icin bir tusa basin...
pause >nul
