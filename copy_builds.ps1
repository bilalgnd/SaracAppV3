$distDir = "C:\Users\bilal\SARACAPP\SARACAPPV3\exe-apk dist"
if (!(Test-Path $distDir)) {
    New-Item -ItemType Directory -Path $distDir
}

$exePath = "C:\Users\bilal\SARACAPP\SARACAPPV3\app1\dist\saracapp2-6.0.3-setup.exe"
$latestYml = "C:\Users\bilal\SARACAPP\SARACAPPV3\app1\dist\latest.yml"
$blockmap = "C:\Users\bilal\SARACAPP\SARACAPPV3\app1\dist\saracapp2-6.0.3-setup.exe.blockmap"
$apkPath = "C:\Users\bilal\SARACAPP\SARACAPPV3\app2\app\build\outputs\apk\release\app-release.apk"

if (Test-Path $exePath) {
    Copy-Item $exePath -Destination "$distDir\SaracAppv6.0.3-setup.exe" -Force
    Write-Host "Copied EXE"
} else { Write-Host "EXE not found!" }

if (Test-Path $latestYml) {
    Copy-Item $latestYml -Destination "$distDir\latest.yml" -Force
    Write-Host "Copied latest.yml"
} else { Write-Host "latest.yml not found!" }

if (Test-Path $blockmap) {
    Copy-Item $blockmap -Destination "$distDir\SaracAppv6.0.3-setup.exe.blockmap" -Force
    Write-Host "Copied blockmap"
} else { Write-Host "blockmap not found!" }

if (Test-Path $apkPath) {
    Copy-Item $apkPath -Destination "$distDir\SaracAppv6.0.3.apk" -Force
    Write-Host "Copied APK"
} else { Write-Host "APK not found!" }
