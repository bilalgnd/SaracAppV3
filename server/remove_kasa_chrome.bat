@echo off
setlocal EnableDelayedExpansion
color 0C
echo ===================================================
echo   SARAÇ APP - KASA CHROME KALDIRMA SCRIPT'I
echo ===================================================
echo.
echo Bu islem "C:\KasaChrome" klasorunu ve Masaustundeki kisayolu kalici olarak SILER!
echo Asil Chrome profilinize (kendi tarayiciniza) HICBIR ZARAR GELMEZ.
echo Sadece dukkan icin olusturulan kopya profil silinecektir.
echo.
set /p DEL_CONFIRM="Kasa Chrome'u tamamen silmek istediginize emin misiniz? (E/H): "

if /I "!DEL_CONFIRM!"=="E" (
    echo.
    echo [1/3] Dosyalarin kilitli olmamasi icin acik Chrome pencereleri kapatiliyor...
    taskkill /F /IM chrome.exe /T >nul 2>&1
    taskkill /F /IM chrome_crashpad_handler.exe /T >nul 2>&1
    timeout /t 3 /nobreak >nul

    echo [2/3] Kasa Chrome profili siliniyor ^("C:\KasaChrome"^)...
    if exist "C:\KasaChrome" (
        REM Bazen rmdir kilitli dosyalara takilabilir, bu yuzden birkac kez dener
        for /L %%i in (1,1,3) do (
            if exist "C:\KasaChrome" (
                rmdir /S /Q "C:\KasaChrome" >nul 2>&1
                timeout /t 1 /nobreak >nul
            )
        )
        
        REM Eger rmdir basarisiz olduysa (ozellikle cok uzun dosya yollarinda), robocopy ile bos klasor mirror yontemini zorla silme
        if exist "C:\KasaChrome" (
            mkdir "%TEMP%\empty_kasa_dir" >nul 2>&1
            robocopy "%TEMP%\empty_kasa_dir" "C:\KasaChrome" /MIR /R:1 /W:1 /NFL /NDL /NJH /NJS >nul 2>&1
            rmdir /S /Q "C:\KasaChrome" >nul 2>&1
            rmdir /S /Q "%TEMP%\empty_kasa_dir" >nul 2>&1
        )

        if exist "C:\KasaChrome" (
            echo [HATA] Klasor tam olarak silinemedi. Geri planda acik kalmis olabilir. Bilgisayari yeniden baslatip deneyin.
        ) else (
            echo Profil klasoru basariyla silindi.
        )
    ) else (
        echo Profil klasoru zaten silinmis veya bulunamadi.
    )

    echo [3/3] Masaustu kisayolu siliniyor...
    
    REM 1. Standart yollari deneyerek silme (/A eklendi, gizli/okunabilir dosyalari da siler)
    del /f /a /q "%USERPROFILE%\Desktop\Kasa Chrome.lnk" >nul 2>&1
    del /f /a /q "%USERPROFILE%\OneDrive\Masaüstü\Kasa Chrome.lnk" >nul 2>&1
    del /f /a /q "%USERPROFILE%\OneDrive\Desktop\Kasa Chrome.lnk" >nul 2>&1
    del /f /a /q "%PUBLIC%\Desktop\Kasa Chrome.lnk" >nul 2>&1

    REM 2. VBScript ile gercek Masaustu yolunu bulup silme
    echo Set oWS = WScript.CreateObject^("WScript.Shell"^) > GetDesktop.vbs
    echo WScript.Echo oWS.SpecialFolders^("Desktop"^) >> GetDesktop.vbs
    for /f "delims=" %%I in ('cscript /nologo GetDesktop.vbs') do (
        set "DESKTOP_PATH=%%I"
    )
    del GetDesktop.vbs >nul 2>&1
    
    if defined DESKTOP_PATH (
        del /f /a /q "!DESKTOP_PATH!\Kasa Chrome.lnk" >nul 2>&1
    )

    echo.
    echo ===================================================
    echo   KALDIRMA ISLEMI BASARIYLA TAMAMLANDI!
    echo ===================================================
) else (
    echo.
    echo Islem iptal edildi. Hicbir dosya silinmedi.
)

echo.
echo Cikmak icin bir tusa basin...
pause >nul
