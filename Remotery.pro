TEMPLATE = lib
CONFIG += static
CONFIG -= app_bundle
CONFIG -= qt
CONFIG -= warn_on

CONFIG(release, debug|release) {
    TARGET = remotery
}

CONFIG(debug, debug|release) {
    TARGET = remotery-dbg
}

DEFINES += _PROFILE_

SOURCES += \
    lib/Remotery.c

HEADERS += \
    lib/Remotery.h



