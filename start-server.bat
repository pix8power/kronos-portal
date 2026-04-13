@echo off
echo Starting ShiftSync Backend...
echo Make sure MongoDB is running!
echo.
cd /d "%~dp0server"
npm run dev
