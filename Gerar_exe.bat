@echo off
:: Verifica se está rodando como administrador
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Reabrindo em modo administrador...
    powershell -Command "Start-Process cmd -ArgumentList '/c \"%~f0\"' -Verb RunAs"
    exit /b
)

:: Daqui pra baixo já está em modo ADM
cd /d "D:\Projeto Finanças"
npm run build

pause