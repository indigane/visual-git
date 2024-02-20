Set pathObject = CreateObject("Scripting.FileSystemObject")
vbsDir = pathObject.GetParentFolderName(WScript.ScriptFullName)
pathToNode = pathObject.BuildPath(vbsDir, "..\runtime\node")
pathToIndexJs = pathObject.BuildPath(vbsDir, "..\backend\index.js")

' Get command-line arguments
Set args = WScript.Arguments
argString = ""
For Each arg In args
  argString = argString & " """ & arg & """"
Next

command = """" & pathToNode & """ """ & pathToIndexJs & """" & argString

' Run NodeJS. 0 means no window. False means do not wait for process to finish.
CreateObject("WScript.Shell").Run command, 0, False
