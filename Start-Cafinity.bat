@echo off
cd /d "%~dp0"
echo Open http://localhost:4173 in a browser.
echo Keep this window open while the cafe demo runs.
node backend/server.mjs
pause
