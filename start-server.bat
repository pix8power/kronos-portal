@echo off
set PATH=C:\Program Files\nodejs;%PATH%
cd /d "%~dp0server"
node src/index.js > "%~dp0server-out.txt" 2>&1
