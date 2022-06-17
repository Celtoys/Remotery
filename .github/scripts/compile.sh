#!/usr/bin/env bash

set -e

ARCH=$1

if [ ! -e build ]; then
    mkdir -p build
fi

function run {
    local args=$*

    echo "$args"
    $args
}

if [ "${ARCH}" == "x64" ]; then
    ARCH="-m64 -DRMT_ARCH_64BIT"
else
    ARCH="-m32"
fi


LINKFLAGS="-lm -pthread"
if [ "$(uname)" == "Darwin" ]; then
    LINKFLAGS=""
fi

# C
run gcc -c ${ARCH} lib/Remotery.c
run gcc -c ${ARCH} -x c++ lib/Remotery.c
run gcc -c ${ARCH} -D RMT_USE_OPENGL=1 lib/Remotery.c
run gcc -c ${ARCH} -D RMT_USE_OPENGL=1 -x c++ lib/Remotery.c
run clang -c ${ARCH} lib/Remotery.c
run clang -c ${ARCH} -xc++ lib/Remotery.c
run clang -c ${ARCH} -DRMT_USE_OPENGL=1 lib/Remotery.c
run clang -c ${ARCH} -xc++ -DRMT_USE_OPENGL=1 lib/Remotery.c

# C++
run cp lib/Remotery.c build/Remotery.cpp
run g++ -c ${ARCH} -Ilib build/Remotery.cpp
run g++ -c ${ARCH} -Ilib -x c++ build/Remotery.cpp
run g++ -c ${ARCH} -Ilib -D RMT_USE_OPENGL=1 build/Remotery.cpp
run g++ -c ${ARCH} -Ilib -D RMT_USE_OPENGL=1 -x c++ build/Remotery.cpp
run clang++ -c ${ARCH} -Ilib build/Remotery.cpp
run clang++ -c ${ARCH} -Ilib -xc++ build/Remotery.cpp
run clang++ -c ${ARCH} -Ilib -DRMT_USE_OPENGL=1 build/Remotery.cpp
run clang++ -c ${ARCH} -Ilib -xc++ -DRMT_USE_OPENGL=1 build/Remotery.cpp

# enable disable
run clang ${ARCH} ${LINKFLAGS} -DRMT_ENABLED=0 -Ilib sample/sample.c lib/Remotery.c -o build/dummy
run clang ${ARCH} ${LINKFLAGS} -DRMT_ENABLED=1 -Ilib sample/sample.c lib/Remotery.c -o build/dummy

# custom hash function
run clang ${ARCH} ${LINKFLAGS} -DRMT_USE_INTERNAL_HASH_FUNCTION=0 -Ilib sample/sample.c .github/scripts/hashfunction.c lib/Remotery.c -o build/dummy
run clang ${ARCH} ${LINKFLAGS} -DRMT_USE_INTERNAL_HASH_FUNCTION=1 -Ilib sample/sample.c lib/Remotery.c -o build/dummy

# samples
run clang ${ARCH} ${LINKFLAGS} -Ilib sample/sample.c lib/Remotery.c -o build/sample
run clang ${ARCH} ${LINKFLAGS} -Ilib sample/dump.c lib/Remotery.c -o build/dump

