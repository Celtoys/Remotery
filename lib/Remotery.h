
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



//
// Compiler identification
//
#if defined(_MSC_VER)
    #define RMT_COMPILER_MSVC
#elif defined(__GNUC__)
    #define RMT_COMPILER_GNUC
#elif defined(__clang__)
    #define RMT_COMPILER_CLANG
#endif


//
// Platform identification
//
#if defined(_WINDOWS) || defined(_WIN32)
    #define RMT_PLATFORM_WINDOWS
#elif defined(__linux__)
    #define RMT_PLATFORM_LINUX
    #define RMT_PLATFORM_POSIX
#elif defined(__APPLE__)
    #define RMT_PLATFORM_MACOS
    #define RMT_PLATFORM_POSIX
#endif


//
// Generate a unique symbol with the given prefix
//
#define RMT_JOIN2(x, y) x ## y
#define RMT_JOIN(x, y) RMT_JOIN2(x, y)
#define RMT_UNIQUE(x) RMT_JOIN(x, __COUNTER__)


//
// Public interface is implemented in terms of these macros to easily enable/disabl itself
//
#ifdef RMT_ENABLED
    #define RMT_OPTIONAL(x) x
    #define RMT_OPTIONAL_RET(x, y) x
#else
    #define RMT_OPTIONAL(x)
    #define RMT_OPTIONAL_RET(x, y) (y)
#endif


/*
------------------------------------------------------------------------------------------------------------------------
------------------------------------------------------------------------------------------------------------------------
   Types
------------------------------------------------------------------------------------------------------------------------
------------------------------------------------------------------------------------------------------------------------
*/



//
// Boolean
//
typedef unsigned int rmtBool;
#define RMT_TRUE ((rmtBool)1)
#define RMT_FALSE ((rmtBool)0)


//
// Unsigned integer types
//
typedef unsigned char rmtU8;
typedef unsigned short rmtU16;
typedef unsigned int rmtU32;
typedef unsigned long long rmtU64;


//
// Signed integer types
//
typedef char rmtS8;
typedef short rmtS16;
typedef int rmtS32;
typedef long long rmtS64;


//
// Const, null-terminated string pointer
//
typedef const char* rmtPStr;


//
// Handle to the main remotery instance
//
typedef struct Remotery Remotery;


//
// All possible error codes
//
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



/*
------------------------------------------------------------------------------------------------------------------------
------------------------------------------------------------------------------------------------------------------------
   C++ Public Interface Extensions
------------------------------------------------------------------------------------------------------------------------
------------------------------------------------------------------------------------------------------------------------
*/



#ifdef __cplusplus


//
// Forward-declartion of private interface for scoped sample type
//
extern "C" void _rmt_EndCPUSample(void);


#ifdef RMT_ENABLED
struct rmt_EndCPUSampleOnScopeExit
{
    ~rmt_EndCPUSampleOnScopeExit()
    {
        rmt_EndCPUSample();
    }
};
#endif



//
// Pairs a call to rmt_BeginCPUSample with its call to rmt_EndCPUSample when leaving scope
//
#define rmt_ScopedCPUSample(name)                                               \
        RMT_OPTIONAL(rmt_BeginCPUSample(name));                                 \
        RMT_OPTIONAL(rmt_EndCPUSampleOnScopeExit rmt_ScopedCPUSample##name);



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


#ifdef __cplusplus
}
#endif

#endif  // RMT_ENABLED


#endif
