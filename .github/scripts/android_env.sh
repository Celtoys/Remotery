#!/usr/bin/env bash

set -e

if [ "" == "${ANDROID_NDK_API_VERSION}" ]; then
    ANDROID_NDK_API_VERSION='16' # Android 4.1
fi

echo "Setting environment for Android"

echo "ANDROID_HOME=${ANDROID_HOME}"
echo "ANDROID_NDK_ROOT=${ANDROID_NDK_ROOT}"
echo "ANDROID_NDK_API_VERSION=${ANDROID_NDK_API_VERSION}"

toolchainhost="linux"
if [ "$(uname)" == "Darwin" ]; then
    toolchainhost="darwin"
fi

echo "ARCH=${ARCH}"

toolchainarch="armv7a-linux-androideabi${ANDROID_NDK_API_VERSION}"
if [ "${ARCH}" == "arm64" ]; then
    toolchainarch="aarch64-linux-android${ANDROID_NDK_API_VERSION}"
fi

# See https://developer.android.com/ndk/guides/other_build_systems

export GCC=${ANDROID_NDK_ROOT}/toolchains/llvm/prebuilt/${toolchainhost}-x86_64/bin/${toolchainarch}-clang
export GXX=${ANDROID_NDK_ROOT}/toolchains/llvm/prebuilt/${toolchainhost}-x86_64/bin/${toolchainarch}-clang++
export CLANGCC=${ANDROID_NDK_ROOT}/toolchains/llvm/prebuilt/${toolchainhost}-x86_64/bin/${toolchainarch}-clang
export CLANGXX=${ANDROID_NDK_ROOT}/toolchains/llvm/prebuilt/${toolchainhost}-x86_64/bin/${toolchainarch}-clang++
export LINKFLAGS="-landroid -lm -pthread"

echo "CLANGCC=${CLANGCC}"
echo "CLANGXX=${CLANGXX}"

if [ ! -e "${CLANGCC}" ]; then
    echo "No such file '${CLANGCC}'"
    exit 1
fi
if [ ! -e "${CLANGXX}" ]; then
    echo "No such file '${CLANGXX}'"
    exit 1
fi
