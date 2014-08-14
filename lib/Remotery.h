

/*
Copyright 2014 Celtoys Ltd

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/


/*

Remotery
--------

A realtime CPU/GPU profiler hosted in a single C file with a viewer that runs in a web browser.

Supported features:

* Lightweight instrumentation of multiple threads running on the CPU.
* Web viewer that runs in Chrome, Firefox and Safari. Custom WebSockets server
  transmits sample data to the browser on a latent thread.
* Profiles itself and shows how it's performing in the viewer.
* Can optionally sample CUDA GPU activity.
* Console output for logging text.


Compiling
---------

* Windows (MSVC) - add lib/Remotery.c and lib/Remotery.h to your program. Set include
  directories to add Remotery/lib path. The required library ws2_32.lib should be picked
  up through the use of the #pragma comment(lib, "ws2_32.lib") directive in Remotery.c.

* Mac OS X (XCode) - simply add lib/Remotery.c and lib/Remotery.h to your program.

* Linux (GCC) - add the source in lib folder. Compilation of the code requires -pthreads for
  library linkage. For example to compile the same run: cc lib/Remotery.c sample/sample.c
  -I lib -pthread -lm

You can define some extra macros to modify what features are compiled into Remotery:

    Macro               Default             Description

    RMT_ENABLED         <defined>           Disable this to not include any bits of Remotery in your build
    RMT_USE_TINYCRT     <not defined>       Used by the Celtoys TinyCRT library (not released yet)
    RMT_USE_CUDA        <not defined>       Assuming CUDA headers/libs are setup, allow CUDA profiling


Basic Use
---------

See the sample directory for further examples. A quick example:

    int main()
    {
        // Create the main instance of Remotery.
        // You need only do this once per program.
        Remotery* rmt;
        rmt_CreateGlobalInstance(&rmt);

        // Explicit begin/end for C
        {
            rmt_BeginCPUSample(LogText);
            rmt_LogText("Time me, please!");
            rmt_EndCPUSample();
        }

        // Scoped begin/end for C++
        {
            rmt_BeginCPUSample(LogText);
            rmt_LogText("Time me, too!");
        }

        // Destroy the main instance of Remotery.
        rmt_DestroyGlobalInstance(rmt);
    }


Running the Viewer
------------------

Double-click or launch `vis/index.html` from the browser.


Sampling CUDA activity
----------------------

Remotery allows for profiling multiple threads of CUDA execution using different asynchronous streams
that must all share the same context. After initialising both Remotery and CUDA you need to bind the
two together using the call:

    rmtCUDABind bind;
    bind.context = m_Context;
    bind.CtxSetCurrent = &cuCtxSetCurrent;
    bind.CtxGetCurrent = &cuCtxGetCurrent;
    bind.EventCreate = &cuEventCreate;
    bind.EventDestroy = &cuEventDestroy;
    bind.EventRecord = &cuEventRecord;
    bind.EventQuery = &cuEventQuery;
    bind.EventElapsedTime = &cuEventElapsedTime;
    rmt_BindCUDA(&bind);

Explicitly pointing to the CUDA interface allows Remotery to be included anywhere in your project without
need for you to link with the required CUDA libraries. After the bind completes you can safely sample any
CUDA activity:

    CUstream stream;

    // Explicit begin/end for C
    {
        rmt_BeginCUDASample(UnscopedSample, stream);
        // ... CUDA code ...
        rmt_EndCUDASample(stream);
    }

    // Scoped begin/end for C++
    {
        rmt_ScopedCUDASample(ScopedSample, stream);
        // ... CUDA code ...
    }

Remotery supports only one context for all threads and will use cuCtxGetCurrent and cuCtxSetCurrent to
ensure the current thread has the context you specify in rmtCUDABind.context.

*/

#ifndef RMT_INCLUDED_H
#define RMT_INCLUDED_H


#define RMT_ENABLED


/*
------------------------------------------------------------------------------------------------------------------------
------------------------------------------------------------------------------------------------------------------------
   Compiler/Platform Detection and Preprocessor Utilities
------------------------------------------------------------------------------------------------------------------------
------------------------------------------------------------------------------------------------------------------------
*/



// Compiler identification
#if defined(_MSC_VER)
    #define RMT_COMPILER_MSVC
#elif defined(__GNUC__)
    #define RMT_COMPILER_GNUC
#elif defined(__clang__)
    #define RMT_COMPILER_CLANG
#endif


// Platform identification
#if defined(_WINDOWS) || defined(_WIN32)
    #define RMT_PLATFORM_WINDOWS
#elif defined(__linux__)
    #define RMT_PLATFORM_LINUX
    #define RMT_PLATFORM_POSIX
#elif defined(__APPLE__)
    #define RMT_PLATFORM_MACOS
    #define RMT_PLATFORM_POSIX
#endif


// Generate a unique symbol with the given prefix
#define RMT_JOIN2(x, y) x ## y
#define RMT_JOIN(x, y) RMT_JOIN2(x, y)
#define RMT_UNIQUE(x) RMT_JOIN(x, __COUNTER__)


// Public interface is implemented in terms of these macros to easily enable/disable itself
#ifdef RMT_ENABLED
    #define RMT_OPTIONAL(x) x
    #define RMT_OPTIONAL_RET(x, y) x
#else
    #define RMT_OPTIONAL(x)
    #define RMT_OPTIONAL_RET(x, y) (y)
#endif
#ifdef RMT_USE_CUDA
    #define RMT_CUDA_OPTIONAL(x) x
    #define RMT_CUDA_OPTIONAL_RET(x, y) x
#else
    #define RMT_CUDA_OPTIONAL(x)
    #define RMT_CUDA_OPTIONAL_RET(x, y) (y)
#endif


/*
------------------------------------------------------------------------------------------------------------------------
------------------------------------------------------------------------------------------------------------------------
   Types
------------------------------------------------------------------------------------------------------------------------
------------------------------------------------------------------------------------------------------------------------
*/



// Boolean
typedef unsigned int rmtBool;
#define RMT_TRUE ((rmtBool)1)
#define RMT_FALSE ((rmtBool)0)


// Unsigned integer types
typedef unsigned char rmtU8;
typedef unsigned short rmtU16;
typedef unsigned int rmtU32;
typedef unsigned long long rmtU64;


// Signed integer types
typedef char rmtS8;
typedef short rmtS16;
typedef int rmtS32;
typedef long long rmtS64;


// Const, null-terminated string pointer
typedef const char* rmtPStr;


// Handle to the main remotery instance
typedef struct Remotery Remotery;


// All possible error codes
enum rmtError
{
    RMT_ERROR_NONE,

    // System errors
    RMT_ERROR_MALLOC_FAIL,                      // Malloc call within remotery failed
    RMT_ERROR_TLS_ALLOC_FAIL,                   // Attempt to allocate thread local storage failed
    RMT_ERROR_CREATE_THREAD_FAIL,               // Failed to create a thread for the server

    // Network TCP/IP socket errors
    RMT_ERROR_SOCKET_INIT_NETWORK_FAIL,         // Network initialisation failure (e.g. on Win32, WSAStartup fails)
    RMT_ERROR_SOCKET_CREATE_FAIL,               // Can't create a socket for connection to the remote viewer
    RMT_ERROR_SOCKET_BIND_FAIL,                 // Can't bind a socket for the server
    RMT_ERROR_SOCKET_LISTEN_FAIL,               // Created server socket failed to enter a listen state
    RMT_ERROR_SOCKET_SET_NON_BLOCKING_FAIL,     // Created server socket failed to switch to a non-blocking state
    RMT_ERROR_SOCKET_INVALID_POLL,              // Poll attempt on an invalid socket
    RMT_ERROR_SOCKET_SELECT_FAIL,               // Server failed to call select on socket
    RMT_ERROR_SOCKET_POLL_ERRORS,               // Poll notified that the socket has errors
    RMT_ERROR_SOCKET_ACCEPT_FAIL,               // Server failed to accept connection from client
    RMT_ERROR_SOCKET_SEND_TIMEOUT,              // Timed out trying to send data
    RMT_ERROR_SOCKET_SEND_FAIL,                 // Unrecoverable error occured while client/server tried to send data
    RMT_ERROR_SOCKET_RECV_NO_DATA,              // No data available when attempting a receive
    RMT_ERROR_SOCKET_RECV_TIMEOUT,              // Timed out trying to receive data
    RMT_ERROR_SOCKET_RECV_FAILED,               // Unrecoverable error occured while client/server tried to receive data

    // WebSocket errors
    RMT_ERROR_WEBSOCKET_HANDSHAKE_NOT_GET,      // WebSocket server handshake failed, not HTTP GET
    RMT_ERROR_WEBSOCKET_HANDSHAKE_NO_VERSION,   // WebSocket server handshake failed, can't locate WebSocket version
    RMT_ERROR_WEBSOCKET_HANDSHAKE_BAD_VERSION,  // WebSocket server handshake failed, unsupported WebSocket version
    RMT_ERROR_WEBSOCKET_HANDSHAKE_NO_HOST,      // WebSocket server handshake failed, can't locate host
    RMT_ERROR_WEBSOCKET_HANDSHAKE_BAD_HOST,     // WebSocket server handshake failed, host is not allowed to connect
    RMT_ERROR_WEBSOCKET_HANDSHAKE_NO_KEY,       // WebSocket server handshake failed, can't locate WebSocket key
    RMT_ERROR_WEBSOCKET_HANDSHAKE_BAD_KEY,      // WebSocket server handshake failed, WebSocket key is ill-formed
    RMT_ERROR_WEBSOCKET_HANDSHAKE_STRING_FAIL,  // WebSocket server handshake failed, internal error, bad string code
    RMT_ERROR_WEBSOCKET_DISCONNECTED,           // WebSocket server received a disconnect request and closed the socket
    RMT_ERROR_WEBSOCKET_BAD_FRAME_HEADER,       // Couldn't parse WebSocket frame header
    RMT_ERROR_WEBSOCKET_BAD_FRAME_HEADER_SIZE,  // Partially received wide frame header size
    RMT_ERROR_WEBSOCKET_BAD_FRAME_HEADER_MASK,  // Partially received frame header data mask
    RMT_ERROR_WEBSOCKET_RECEIVE_TIMEOUT,        // Timeout receiving frame header

    RMT_ERROR_REMOTERY_NOT_CREATED,             // Remotery object has not been created
    RMT_ERROR_SEND_ON_INCOMPLETE_PROFILE,       // An attempt was made to send an incomplete profile tree to the client

    // CUDA error messages
    RMT_ERROR_CUDA_DEINITIALIZED,               // This indicates that the CUDA driver is in the process of shutting down
    RMT_ERROR_CUDA_NOT_INITIALIZED,             // This indicates that the CUDA driver has not been initialized with cuInit() or that initialization has failed
    RMT_ERROR_CUDA_INVALID_CONTEXT,             // This most frequently indicates that there is no context bound to the current thread
    RMT_ERROR_CUDA_INVALID_VALUE,               // This indicates that one or more of the parameters passed to the API call is not within an acceptable range of values
    RMT_ERROR_CUDA_INVALID_HANDLE,              // This indicates that a resource handle passed to the API call was not valid
    RMT_ERROR_CUDA_OUT_OF_MEMORY,               // The API call failed because it was unable to allocate enough memory to perform the requested operation
    RMT_ERROR_ERROR_NOT_READY,                  // This indicates that a resource handle passed to the API call was not valid

    RMT_ERROR_CUDA_UNKNOWN,
};



/*
------------------------------------------------------------------------------------------------------------------------
------------------------------------------------------------------------------------------------------------------------
   Public Interface
------------------------------------------------------------------------------------------------------------------------
------------------------------------------------------------------------------------------------------------------------
*/



// Can call remotery functions on a null pointer

#define rmt_CreateGlobalInstance(rmt)                                       \
    RMT_OPTIONAL_RET(_rmt_CreateGlobalInstance(rmt), RMT_ERROR_NONE)

#define rmt_DestroyGlobalInstance(rmt)                                      \
    RMT_OPTIONAL(_rmt_DestroyGlobalInstance(rmt))

#define rmt_SetGlobalInstance(rmt)                                          \
    RMT_OPTIONAL(_rmt_SetGlobalInstance(rmt))

#define rmt_GetGlobalInstance()                                             \
    RMT_OPTIONAL_RET(_rmt_GetGlobalInstance(), NULL)

#define rmt_SetCurrentThreadName(rmt)                                       \
    RMT_OPTIONAL(_rmt_SetCurrentThreadName(rmt))

#define rmt_LogText(text)                                                   \
    RMT_OPTIONAL(_rmt_LogText(text))

#define rmt_BeginCPUSample(name)                                            \
    RMT_OPTIONAL({                                                          \
        static rmtU32 rmt_sample_hash_##name = 0;                           \
        _rmt_BeginCPUSample(#name, &rmt_sample_hash_##name);                \
    })

#define rmt_EndCPUSample()                                                  \
    RMT_OPTIONAL(_rmt_EndCPUSample())


// Structure to fill in when binding CUDA to Remotery
typedef struct rmtCUDABind
{
    // The main context that all driver functions apply before each call
    void* context;

    // Driver API function pointers that need to be pointed to
    // Untyped so that the CUDA headers are not required in this file
    // NOTE: These are named differently to the CUDA functions because the CUDA API has a habit of using
    // macros to point function calls to different versions, e.g. cuEventDestroy is a macro for
    // cuEventDestroy_v2.
    void* CtxSetCurrent;
    void* CtxGetCurrent;
    void* EventCreate;
    void* EventDestroy;
    void* EventRecord;
    void* EventQuery;
    void* EventElapsedTime;

} rmtCUDABind;


// Call once after you've initialised CUDA to bind it to Remotery
#define rmt_BindCUDA(bind)                                                  \
    RMT_CUDA_OPTIONAL(_rmt_BindCUDA(bind))

// Mark the beginning of a CUDA sample on the specified asynchronous stream
#define rmt_BeginCUDASample(name, stream)                                   \
    RMT_CUDA_OPTIONAL({                                                          \
        static rmtU32 rmt_sample_hash_##name = 0;                           \
        _rmt_BeginCUDASample(#name, &rmt_sample_hash_##name, stream);       \
    })

// Mark the end of a CUDA sample on the specified asynchronous stream
#define rmt_EndCUDASample(stream)                                           \
    RMT_CUDA_OPTIONAL(_rmt_EndCUDASample(stream))



/*
------------------------------------------------------------------------------------------------------------------------
------------------------------------------------------------------------------------------------------------------------
   C++ Public Interface Extensions
------------------------------------------------------------------------------------------------------------------------
------------------------------------------------------------------------------------------------------------------------
*/



#ifdef __cplusplus


// Types that end samples in their destructors
#ifdef RMT_ENABLED
extern "C" void _rmt_EndCPUSample(void);
struct rmt_EndCPUSampleOnScopeExit
{
    ~rmt_EndCPUSampleOnScopeExit()
    {
        rmt_EndCPUSample();
    }
};
#ifdef RMT_USE_CUDA
extern "C" void _rmt_EndCUDASample(void* stream);
struct rmt_EndCUDASampleOnScopeExit
{
    rmt_EndCUDASampleOnScopeExit(void* stream) : stream(stream)
    {
    }
    ~rmt_EndCUDASampleOnScopeExit()
    {
        rmt_EndCUDASample(stream);
    }
    void* stream;
};
#endif
#endif



// Pairs a call to rmt_Begin<TYPE>Sample with its call to rmt_End<TYPE>Sample when leaving scope
#define rmt_ScopedCPUSample(name)                                               \
        RMT_OPTIONAL(rmt_BeginCPUSample(name));                                 \
        RMT_OPTIONAL(rmt_EndCPUSampleOnScopeExit rmt_ScopedCPUSample##name);
#define rmt_ScopedCUDASample(name, stream)                                                  \
        RMT_CUDA_OPTIONAL(rmt_BeginCUDASample(name, stream));                               \
        RMT_CUDA_OPTIONAL(rmt_EndCUDASampleOnScopeExit rmt_ScopedCUDASample##name(stream));

#endif



/*
------------------------------------------------------------------------------------------------------------------------
------------------------------------------------------------------------------------------------------------------------
   Private Interface - don't directly call these
------------------------------------------------------------------------------------------------------------------------
------------------------------------------------------------------------------------------------------------------------
*/



#ifdef RMT_ENABLED

#ifdef __cplusplus
extern "C" {
#endif


enum rmtError _rmt_CreateGlobalInstance(Remotery** remotery);
void _rmt_DestroyGlobalInstance(Remotery* remotery);
void _rmt_SetGlobalInstance(Remotery* remotery);
Remotery* _rmt_GetGlobalInstance();


void _rmt_SetCurrentThreadName(rmtPStr thread_name);


void _rmt_LogText(rmtPStr text);

//
// 'hash_cache' stores a pointer to a sample name's hash value. Internally this is used to identify unique callstacks and it
// would be ideal that it's not recalculated each time the sample is used. This can be statically cached at the point
// of call or stored elsewhere when dynamic names are required.
//
// If 'hash_cache' is NULL then this call becomes more expensive, as it has to recalculate the hash of the name.
//
void _rmt_BeginCPUSample(rmtPStr name, rmtU32* hash_cache);
void _rmt_EndCPUSample(void);


#ifdef RMT_USE_CUDA
void _rmt_BindCUDA(const rmtCUDABind* bind);
void _rmt_BeginCUDASample(rmtPStr name, rmtU32* hash_cache, void* stream);
void _rmt_EndCUDASample(void* stream);
#endif


#ifdef __cplusplus
}
#endif

#endif  // RMT_ENABLED


#endif
