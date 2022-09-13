rem echo off

rem debug
dir

echo ""
echo "*********************************************************************************"
echo "Running thread_asan:"
.\build\thread_asan 2000


echo ""
echo "*********************************************************************************"
echo "Running dump:"
.\build\dump.exe


echo ""
echo "*********************************************************************************"
echo "Tests done"

