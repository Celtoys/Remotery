#!/usr/bin/env bash

set -e

echo "Running dump:"
./build/dump

if [ -e ./build/thread_tsan ]; then
    echo ""
    echo "*********************************************************************************"
    echo "Running thread_tsan:"
    ./build/thread_tsan 2000
fi

if [ -e ./build/thread_ubsan ]; then
    echo ""
    echo "*********************************************************************************"
    echo "Running thread_ubsan:"
    ./build/thread_ubsan 2000
fi

if [ -e ./build/thread_asan ]; then
    echo ""
    echo "*********************************************************************************"
    echo "Running thread_asan:"
    ./build/thread_asan 2000
fi


echo ""
echo "*********************************************************************************"
echo "Tests done"
