#!/usr/bin/env bash

set -e

echo "Running dump:"
./build/dump

echo "Running thread_tsan:"
./build/thread_tsan 2000

echo "Running thread_ubsan:"
./build/thread_ubsan 2000

echo "Running thread_asan:"
./build/thread_asan 2000
