#!/usr/bin/env bash

set -e

PLATFORM=$1
ARCH=$2
BUILDMODE=$3

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

if [ ! -e build ]; then
    mkdir -p build
fi

function run {
    local args=$*

    echo "$args"
    $args
}

function quit_on_error {
    echo "$*"
    exit 1
}

if [ "${ARCH}" == "x64" ] || [ "${ARCH}" == "arm64" ]; then
    ARCH_FLAGS="-m64"
else
    ARCH_FLAGS="-m32"
fi

LINKFLAGS="-lm -pthread"
if [ "macos" == "${PLATFORM}" ]; then
    LINKFLAGS=""
fi

if [ "android" == "${PLATFORM}" ]; then
    . ${SCRIPT_DIR}/android_env.sh
else
    GCC=$(which gcc)
    GXX=$(which g++)
    CLANGCC=$(which clang)
    CLANGXX=$(which clang++)
    echo "GCC=${GCC}"
    echo "GXX=${GXX}"
    echo "CLANGCC=${CLANGCC}"
    echo "CLANGXX=${CLANGXX}"
fi

if [ "" == "${GCC}" ]; then
    quit_on_error "No GCC speficied"
fi
if [ "" == "${GXX}" ]; then
    quit_on_error "No GXX speficied"
fi
if [ "" == "${CLANGCC}" ]; then
    quit_on_error "No CLANGCC speficied"
fi
if [ "" == "${CLANGXX}" ]; then
    quit_on_error "No CLANGXX speficied"
fi

# C

run ${GCC} -c ${ARCH_FLAGS} lib/Remotery.c
run ${GCC} -c ${ARCH_FLAGS} -x c++ lib/Remotery.c
run ${GCC} -c ${ARCH_FLAGS} -D RMT_USE_OPENGL=1 lib/Remotery.c
run ${GCC} -c ${ARCH_FLAGS} -D RMT_USE_OPENGL=1 -x c++ lib/Remotery.c
run ${CLANGCC} -c ${ARCH_FLAGS} lib/Remotery.c
run ${CLANGCC} -c ${ARCH_FLAGS} -xc++ lib/Remotery.c
run ${CLANGCC} -c ${ARCH_FLAGS} -DRMT_USE_OPENGL=1 lib/Remotery.c
run ${CLANGCC} -c ${ARCH_FLAGS} -DRMT_USE_LEGACY_ATOMICS=1 lib/Remotery.c

# C++
run cp lib/Remotery.c build/Remotery.cpp
run ${GXX} -c ${ARCH_FLAGS} -Ilib build/Remotery.cpp
run ${GXX} -c ${ARCH_FLAGS} -Ilib -x c++ build/Remotery.cpp
run ${GXX} -c ${ARCH_FLAGS} -Ilib -D RMT_USE_OPENGL=1 build/Remotery.cpp
run ${GXX} -c ${ARCH_FLAGS} -Ilib -D RMT_USE_OPENGL=1 -x c++ build/Remotery.cpp
run ${CLANGXX} -c ${ARCH_FLAGS} -Ilib build/Remotery.cpp
run ${CLANGXX} -c ${ARCH_FLAGS} -Ilib -xc++ build/Remotery.cpp
run ${CLANGXX} -c ${ARCH_FLAGS} -Ilib -DRMT_USE_OPENGL=1 build/Remotery.cpp
run ${CLANGXX} -c ${ARCH_FLAGS} -Ilib -xc++ -DRMT_USE_OPENGL=1 build/Remotery.cpp
run ${CLANGXX} -c ${ARCH_FLAGS} -Ilib -DRMT_USE_LEGACY_ATOMICS=1 build/Remotery.cpp

# enable disable
run ${CLANGCC} ${ARCH_FLAGS} ${LINKFLAGS} -DRMT_ENABLED=0 -Ilib sample/sample.c lib/Remotery.c -o build/dummy
run ${CLANGCC} ${ARCH_FLAGS} ${LINKFLAGS} -DRMT_ENABLED=1 -Ilib sample/sample.c lib/Remotery.c -o build/dummy

# custom hash function
run ${CLANGCC} ${ARCH_FLAGS} ${LINKFLAGS} -DRMT_USE_INTERNAL_HASH_FUNCTION=0 -Ilib sample/sample.c .github/scripts/hashfunction.c lib/Remotery.c -o build/dummy
run ${CLANGCC} ${ARCH_FLAGS} ${LINKFLAGS} -DRMT_USE_INTERNAL_HASH_FUNCTION=1 -Ilib sample/sample.c lib/Remotery.c -o build/dummy

# samples
run ${CLANGCC} ${ARCH_FLAGS} ${LINKFLAGS} -Ilib sample/sample.c lib/Remotery.c -o build/sample
run ${CLANGCC} ${ARCH_FLAGS} ${LINKFLAGS} -Ilib sample/dump.c lib/Remotery.c -o build/dump

if [ "${ARCH}" == "x64" ] || [ "${ARCH}" == "arm64" ]; then
    run ${CLANGCC} ${ARCH_FLAGS} ${LINKFLAGS} -fsanitize=thread -g -O0 -Ilib sample/thread.c lib/Remotery.c -o build/thread_tsan
    run ${CLANGCC} ${ARCH_FLAGS} ${LINKFLAGS} -fsanitize=undefined -g -O0 -Ilib sample/thread.c lib/Remotery.c -o build/thread_ubsan
    run ${CLANGCC} ${ARCH_FLAGS} ${LINKFLAGS} -fsanitize=address -g -O0 -Ilib sample/thread.c lib/Remotery.c -o build/thread_asan
fi

