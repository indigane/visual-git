@echo off
SET "PATH_TO_NODE=%~dp0..\runtime\node.exe"
SET "PATH_TO_INDEX_JS=%~dp0..\backend\index.js"
SET "PATH_TO_VBS=%~dp0vg.vbs"

IF NOT EXIST "%PATH_TO_NODE%" (
  echo node.exe not found. Please place node.exe in the runtime/ directory.
  exit /b
)

REM Attempt to get the path to the .git dir. If it fails, output the error, otherwise continue.
git rev-parse --absolute-git-dir >NUL 2>&1 || (
  git rev-parse --absolute-git-dir 2>&1
  exit /b
)

REM Attempt to run vg.vbs, which can hide the window.
cscript //B //Nologo "%PATH_TO_VBS%" %*
IF ERRORLEVEL 1 (
  REM If VBScript failed, run Node.js directly, with window visible.
  start "Visual Git %CD%" "%PATH_TO_NODE%" "%PATH_TO_INDEX_JS%" %*
)
