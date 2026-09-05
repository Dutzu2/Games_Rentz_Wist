@echo off
setlocal
cd /d "%~dp0"
set PORT=8002
py -3 -m http.server %PORT%
