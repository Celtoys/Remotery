echo off

set PLATFORM=%1
set BUILDMODE=%2

if NOT DEFINED VCINSTALLDIR (
    echo "Version %VERSION% was not found"
    echo "No compatible visual studio found! run vcvarsall.bat first!"
    exit 1
)

echo "Using " %VCINSTALLDIR%

mkdir build

set CL_OPTS=/W4

if "%BUILDMODE%" == "debug" (
    set CL_OPTS=%CL_OPTS% /D_DEBUG
)

if "%BUILDMODE%" == "release" (
    set CL_OPTS=%CL_OPTS% /DNDEBUG
)

echo "CL_OPTS: " %CL_OPTS%

echo "C mode"
cl.exe /c %CL_OPTS% lib\Remotery.c  || goto :error

echo "C++ mode"
cl.exe /c %CL_OPTS% -TP lib\Remotery.c  || goto :error

echo "OpenGL"
cl.exe /c %CL_OPTS% -DRMT_USE_OPENGL=1 lib\Remotery.c  || goto :error

echo "C++ mode OpenGL"
cl.exe /c %CL_OPTS% -TP -DRMT_USE_OPENGL=1 lib\Remotery.c || goto :error

echo "D3D11"
cl.exe /c %CL_OPTS% -DRMT_USE_D3D11=1 lib\Remotery.c || goto :error

echo "C++ mode D3D11"
cl.exe /c %CL_OPTS% -TP -DRMT_USE_D3D11=1 lib\Remotery.c || goto :error

echo "Enable Disable"
cl.exe %CL_OPTS% -Ilib -DRMT_ENABLED=0 sample/sample.c lib/Remotery.c /link /out:build\dummy.exe || goto :error
cl.exe %CL_OPTS% -Ilib -DRMT_ENABLED=1 sample/sample.c lib/Remotery.c /link /out:build\dummy.exe || goto :error

echo "Custom hash function"
cl.exe %CL_OPTS% -Ilib -DRMT_USE_INTERNAL_HASH_FUNCTION=0 sample/sample.c .github/scripts/hashfunction.c lib/Remotery.c /link /out:build\dummy.exe || goto :error
cl.exe %CL_OPTS% -Ilib -DRMT_USE_INTERNAL_HASH_FUNCTION=1 sample/sample.c lib/Remotery.c /link /out:build\dummy.exe || goto :error

echo "Samples"
cl.exe %CL_OPTS% -Ilib sample/sample.c lib/Remotery.c /link /out:build\sample.exe || goto :error
cl.exe %CL_OPTS% -Ilib sample/dump.c lib/Remotery.c /link /out:build\dump.exe || goto :error

goto :EOF

:error
echo Failed with error #%errorlevel%.
exit /b %errorlevel%
