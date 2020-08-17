cmake_minimum_required(VERSION 3.1)
project(Remotery)

option(REMOTERY_USE_CUDA "Enable CUDA profiling with Remotery" OFF)

set(Remotery_SOURCE_DIR ${CMAKE_CURRENT_SOURCE_DIR}/lib)
set(Remotery_HEADERS ${Remotery_SOURCE_DIR}/Remotery.h)
set(Remotery_SOURCES ${Remotery_SOURCE_DIR}/Remotery.c)

if(APPLE)
    list(APPEND Remotery_SOURCES ${Remotery_SOURCE_DIR}/RemoteryMetal.mm)
endif()

add_library(remotery ${Remotery_SOURCES})

if(UNIX OR WIN32)
    target_compile_definitions(remotery PUBLIC RMT_USE_OPENGL=1)
endif()
if(WIN32)
    target_compile_definitions(remotery PUBLIC RMT_USE_D3D11=1)
endif()
if(APPLE)
    target_compile_definitions(remotery PUBLIC RMT_USE_METAL=1)
endif()

if(MSVC)
  target_link_libraries(remotery ws2_32)
else()
    find_package(Threads REQUIRED)
    target_link_libraries(remotery Threads::Threads m)
endif()

if(BUILD_SHARED_LIBS)
    target_compile_definitions(remotery PUBLIC RMT_DLL)
endif()

if(REMOTERY_USE_CUDA)

    if(${CMAKE_VERSION} VERSION_LESS "3.17") 
        find_package(CUDA REQUIRED)
        target_link_libraries(remotery ${CUDA_LIBRARIES})
        target_include_directories(remotery PRIVATE ${CUDA_INCLUDE_DIRS})
    else()
        find_package(CUDAToolkit REQUIRED)
        target_link_libraries(remotery CUDA::cudart)
    endif()

    target_compile_definitions(remotery PUBLIC RMT_USE_CUDA=1)
endif()

include(GNUInstallDirs)
install(TARGETS remotery
        RUNTIME DESTINATION ${CMAKE_INSTALL_BINDIR}
        LIBRARY DESTINATION ${CMAKE_INSTALL_LIBDIR}
        ARCHIVE DESTINATION ${CMAKE_INSTALL_LIBDIR})
install(FILES ${Remotery_HEADERS} DESTINATION ${CMAKE_INSTALL_INCLUDEDIR})
