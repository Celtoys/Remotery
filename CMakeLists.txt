cmake_minimum_required(VERSION 3.16)

project(remotery)

# By default, we build in Release mode.
if(NOT CMAKE_BUILD_TYPE)
    set(
        CMAKE_BUILD_TYPE "Release" CACHE
        STRING "Choose the type of build." FORCE
    )
endif()

# Versioning
# ==========

# Project version

file(
    STRINGS "${CMAKE_CURRENT_SOURCE_DIR}/lib/Remotery.h" remotery_version_defines
    REGEX "#define RMT_VERSION_(MAJOR|MINOR|PATCH)"
)

foreach(ver ${remotery_version_defines})
    if(ver MATCHES "#define RMT_VERSION_(MAJOR|MINOR|PATCH) +([^ ]+)$")
        set(
            REMOTERY_VERSION_${CMAKE_MATCH_1} "${CMAKE_MATCH_2}"
            CACHE INTERNAL ""
        )
    endif()
endforeach()

set(
    ${PROJECT_NAME}_VERSION
    ${REMOTERY_VERSION_MAJOR}.${REMOTERY_VERSION_MINOR}.${REMOTERY_VERSION_PATCH}
)

message(STATUS "${PROJECT_NAME} version: ${${PROJECT_NAME}_VERSION}")

# Binary version
# See the following URL for explanations about the binary versionning
# https://www.gnu.org/software/libtool/manual/html_node/Updating-version-info.html#Updating-version-info

file(
    STRINGS "${CMAKE_CURRENT_SOURCE_DIR}/lib/Remotery.h" remotery_binary_defines
    REGEX "#define RMT_BINARY_(CURRENT|REVISION|AGE)"
)

foreach(ver ${remotery_binary_defines})
    if(ver MATCHES "#define RMT_BINARY_(CURRENT|REVISION|AGE) +([^ ]+)$")
        set(
            REMOTERY_BINARY_${CMAKE_MATCH_1} "${CMAKE_MATCH_2}"
            CACHE INTERNAL ""
        )
    endif()
endforeach()

set(REMOTERY_BINARY_VERSION
    ${REMOTERY_BINARY_CURRENT}.${REMOTERY_BINARY_REVISION}.${REMOTERY_BINARY_AGE})
message(STATUS "${PROJECT_NAME} binary version: ${REMOTERY_BINARY_VERSION}")


# Build options
# =============

option(REMOTERY_BUILD_SHARED_LIBS "Build remotery shared library" ON)
option(REMOTERY_BUILD_STATIC_LIBS "Build remotery static library" ON)

message(STATUS "Build shared libraries: ${REMOTERY_BUILD_SHARED_LIBS}")
message(STATUS "Build static libraries: ${REMOTERY_BUILD_STATIC_LIBS}")

# Targets and link
# ================

include(CheckCXXCompilerFlag)

macro(remotery_create_target target_name linkage output_name)
    string(TOUPPER "${linkage}" linkage_upper)

    if(NOT ${linkage_upper} MATCHES "^(STATIC|SHARED)$")
        message(FATAL_ERROR "Invalid linkage: ${linkage}")
    endif()

    add_library(
        ${target_name} ${linkage_upper}
        lib/Remotery.c
        lib/Remotery.h
    )

    target_include_directories(
        ${target_name}
        PUBLIC
        $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/lib>
        $<INSTALL_INTERFACE:include>
    )

    set_target_properties(
        ${target_name}
        PROPERTIES
        OUTPUT_NAME ${output_name}
        VERSION ${${PROJECT_NAME}_VERSION}
        SOVERSION ${REMOTERY_VERSION_MAJOR}
        PUBLIC_HEADER "lib/Remotery.h"
    )

    # Compilation and linkage flags
    # =============================

    if(MSVC)
        target_compile_options(
            ${target_name} PUBLIC /W4
            # NOTE(jjerphan): treating warnings as error makes the installation fail.
            # TODO: remove "/W4"-emitted warnings and use "/WX"
            # /WX
        )
    else()
        target_compile_options(
            ${target_name} PUBLIC -pthread -Wall -Wextra -Wunused-parameter
        )
    endif()

    if(${linkage_upper} STREQUAL "STATIC")
        target_compile_definitions(${target_name} PUBLIC RMT_STATIC_LIB)
    endif()



endmacro()

set(remotery_targets "")

if(REMOTERY_BUILD_SHARED_LIBS)
    remotery_create_target(remotery SHARED remotery)
    list(APPEND remotery_targets remotery)
endif()

if(REMOTERY_BUILD_STATIC_LIBS)
    # On Windows, a static library should use a different output name
    # to avoid name conflicts with the shared library.
    if(WIN32)
        remotery_create_target(remotery-static STATIC remotery_static)
    else()
        remotery_create_target(remotery-static STATIC remotery)
    endif()

    list(APPEND remotery_targets remotery-static)
endif()

# Tests
# =====

# TODO: implement a test suite.

# Installation
# ============

include(GNUInstallDirs)
include(CMakePackageConfigHelpers)

set(
    REMOTERY_CMAKECONFIG_INSTALL_DIR "${CMAKE_INSTALL_LIBDIR}/cmake/${PROJECT_NAME}"
    CACHE STRING "install path for remoteryConfig.cmake"
)

install(
    TARGETS ${remotery_targets}
    EXPORT ${PROJECT_NAME}-targets
    ARCHIVE DESTINATION ${CMAKE_INSTALL_LIBDIR}
    LIBRARY DESTINATION ${CMAKE_INSTALL_LIBDIR}
    RUNTIME DESTINATION ${CMAKE_INSTALL_BINDIR}
    PUBLIC_HEADER DESTINATION ${CMAKE_INSTALL_INCLUDEDIR}/remotery
)

# Makes the project importable from the build directory
export(
    EXPORT ${PROJECT_NAME}-targets
    FILE "${CMAKE_CURRENT_BINARY_DIR}/${PROJECT_NAME}Targets.cmake"
)

# Configure 'remoteryConfig.cmake' for a build tree
set(REMOTERY_CONFIG_CODE "####### Expanded from \@remotery_CONFIG_CODE\@ #######\n")
set(REMOTERY_CONFIG_CODE "${REMOTERY_CONFIG_CODE}set(CMAKE_MODULE_PATH \"${CMAKE_CURRENT_SOURCE_DIR}/cmake;\${CMAKE_MODULE_PATH}\")\n")
set(REMOTERY_CONFIG_CODE "${REMOTERY_CONFIG_CODE}####### End of expanded section on remotery_CONFIG_CODE #######\n")

configure_package_config_file(
    ${PROJECT_NAME}Config.cmake.in
    "${CMAKE_CURRENT_BINARY_DIR}/${PROJECT_NAME}Config.cmake"
    INSTALL_DESTINATION ${PROJECT_BINARY_DIR}
)

# Configure 'remoteryConfig.cmake' for an install tree
configure_package_config_file(
    ${PROJECT_NAME}Config.cmake.in
    "${CMAKE_CURRENT_BINARY_DIR}/CMakeFiles/${PROJECT_NAME}Config.cmake"
    INSTALL_DESTINATION ${REMOTERY_CMAKECONFIG_INSTALL_DIR}
)

write_basic_package_version_file(
    "${CMAKE_CURRENT_BINARY_DIR}/${PROJECT_NAME}ConfigVersion.cmake"
    VERSION ${${PROJECT_NAME}_VERSION}
    COMPATIBILITY AnyNewerVersion
)

install(
    FILES
    "${CMAKE_CURRENT_BINARY_DIR}${CMAKE_FILES_DIRECTORY}/${PROJECT_NAME}Config.cmake"
    "${CMAKE_CURRENT_BINARY_DIR}/${PROJECT_NAME}ConfigVersion.cmake"
    DESTINATION ${REMOTERY_CMAKECONFIG_INSTALL_DIR}
)

install(
    EXPORT ${PROJECT_NAME}-targets
    FILE ${PROJECT_NAME}Targets.cmake
    DESTINATION ${REMOTERY_CMAKECONFIG_INSTALL_DIR}
)
