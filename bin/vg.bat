@echo off

SET "PATH_TO_NODE=%~dp0..\runtime\node"

SET "PATH_TO_INDEX_JS=%~dp0..\backend\index.js"

"%PATH_TO_NODE%" "%PATH_TO_INDEX_JS%" %*
