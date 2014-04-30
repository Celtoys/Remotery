# Remotery - a C API for profiling with a html viewer

The source files for the library are in the lib folder. For the viewer, load vis/index.html in a compliant browser (Safari, Chrome and Firefox tested).

## Compiling Notes:

Brief notes.

- Windows Visual Studio: add lib/Remotery.c and lib/Remotery.h to your program. Set include directories to add Remotery/lib path. The required library ws2_32.lib should be picked up through the use of the #pragma comment(lib, "ws2_32.lib") directive in Remotery.c.

- XCode: simple add lib/Remotery.c and lib/Remotery.h to your program.

- Linux: Add the source in lib folder. Compilation of the code requires -pthreads for library linkage. For example to compile the same run: cc lib/Remotery.c sample/sample.c -I lib -pthread -lm