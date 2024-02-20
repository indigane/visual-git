@echo off
SET "PATH_TO_NODE=%~dp0..\runtime\node"
SET "PATH_TO_INDEX_JS=%~dp0..\backend\index.js"
SET "PATH_TO_VBS=%~dp0vg.vbs"

REM Attempt to run vg.vbs, which can hide the window.
cscript //B //Nologo "%PATH_TO_VBS%" %*
IF ERRORLEVEL 1 (
  REM If VBScript failed, run Node.js directly, with window visible.
  start "Visual Git %CD%" "%PATH_TO_NODE%" "%PATH_TO_INDEX_JS%" %*
)
