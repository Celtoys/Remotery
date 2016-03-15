cmake_minimum_required(VERSION 3.2)

project(remotery-sample)

#Sends the -std=c99 flag to the gcc compiler
add_definitions(-std=c99)

include_directories(lib)

IF( SIZEOF_VOID_P EQUAL 8 )
	SET( SSE_MODE "" )
ELSE()
	SET( SSE_MODE "/arch:SSE2" )
ENDIF()

SET( WarnAsError "/WX" )
SET( CMAKE_C_FLAGS_DEBUG "${CMAKE_C_FLAGS_DEBUG} /fp:fast /Ob1 /Oi /Oy- /W4 ${WarnAsError} /wd4127 /wd4512 /wd4239 ${SSE_MODE}" )
SET( CMAKE_C_FLAGS_RELEASE "${CMAKE_C_FLAGS_RELEASE} /fp:fast /Ob2 /Oi /Oy- /W4 /WX /wd4127 /wd4512 /wd4239 ${SSE_MODE}" )
SET( CMAKE_CXX_FLAGS_DEBUG "${CMAKE_CXX_FLAGS_DEBUG} /fp:fast /Ob1 /Oi /Oy- /W4 ${WarnAsError} /wd4127 /wd4512 /wd4239 ${SSE_MODE}" )
SET( CMAKE_CXX_FLAGS_RELEASE "${CMAKE_CXX_FLAGS_RELEASE} /fp:fast /Ob2 /Oi /Oy- /W4 /WX /wd4127 /wd4512 /wd4239 ${SSE_MODE}" )

#This tells CMake to fib.c and name it fibonacci
add_executable(remotery-sample lib/Remotery.c sample/sample.c)
