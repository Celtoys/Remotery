
#ifndef RMT_INCLUDED_H
#define RMT_INCLUDED_H


typedef unsigned int rmtBool;
#define RMT_TRUE ((rmtBool)1)
#define RMT_FALSE ((rmtBool)0)


typedef unsigned char rmtU8;
typedef unsigned short rmtU16;
typedef unsigned int rmtU32;
typedef unsigned long long rmtU64;


typedef char rmtS8;
typedef short rmtS16;
typedef int rmtS32;
typedef long long rmtS64;


typedef const char* rmtPStr;


typedef struct Remotery Remotery;


enum rmtError
{
	RMT_ERROR_NONE,

	// System errors
	RMT_ERROR_MALLOC_FAIL,						// Malloc call within remotery failed

	// Network TCP/IP socket errors
	RMT_ERROR_SOCKET_INIT_NETWORK_FAIL,			// Network initialisation failure (e.g. on Win32, WSAStartup fails)
	RMT_ERROR_SOCKET_CREATE_FAIL,				// Can't create a socket for connection to the remote viewer
	RMT_ERROR_SOCKET_BIND_FAIL,					// Can't bind a socket for the server
	RMT_ERROR_SOCKET_LISTEN_FAIL,				// Created server socket failed to enter a listen state
	RMT_ERROR_SOCKET_SET_NON_BLOCKING_FAIL,		// Created server socket failed to switch to a non-blocking state
	RMT_ERROR_SOCKET_INVALID_POLL,				// Poll attempt on an invalid socket
	RMT_ERROR_SOCKET_SELECT_FAIL,				// Server failed to call select on socket
	RMT_ERROR_SOCKET_POLL_ERRORS,				// Poll notified that the socket has errors
	RMT_ERROR_SOCKET_ACCEPT_FAIL,				// Server failed to accept connection from client
	RMT_ERROR_SOCKET_SEND_TIMEOUT,				// Timed out trying to send data
	RMT_ERROR_SOCKET_SEND_FAIL,					// Unrecoverable error occured while client/server tried to send data
	RMT_ERROR_SOCKET_RECV_NO_DATA,				// No data available when attempting a receive
	RMT_ERROR_SOCKET_RECV_TIMEOUT,				// Timed out trying to receive data
	RMT_ERROR_SOCKET_RECV_FAILED,				// Unrecoverable error occured while client/server tried to receive data

	// WebSocket errors
	RMT_ERROR_WEBSOCKET_HANDSHAKE_NOT_GET,		// WebSocket server handshake failed, not HTTP GET
	RMT_ERROR_WEBSOCKET_HANDSHAKE_NO_VERSION,	// WebSocket server handshake failed, can't locate WebSocket version
	RMT_ERROR_WEBSOCKET_HANDSHAKE_BAD_VERSION,	// WebSocket server handshake failed, unsupported WebSocket version
	RMT_ERROR_WEBSOCKET_HANDSHAKE_NO_HOST,		// WebSocket server handshake failed, can't locate host
	RMT_ERROR_WEBSOCKET_HANDSHAKE_BAD_HOST,		// WebSocket server handshake failed, host is not allowed to connect
	RMT_ERROR_WEBSOCKET_HANDSHAKE_NO_KEY,		// WebSocket server handshake failed, can't locate WebSocket key
	RMT_ERROR_WEBSOCKET_HANDSHAKE_BAD_KEY,		// WebSocket server handshake failed, WebSocket key is ill-formed
	RMT_ERROR_WEBSOCKET_HANDSHAKE_STRING_FAIL,	// WebSocket server handshake failed, internal error, bad string code
	RMT_ERROR_WEBSOCKET_DISCONNECTED,			// WebSocket server received a disconnect request and closed the socket
	RMT_ERROR_WEBSOCKET_BAD_FRAME_HEADER,		// Couldn't parse WebSocket frame header
	RMT_ERROR_WEBSOCKET_BAD_FRAME_HEADER_SIZE,	// Partially received wide frame header size
	RMT_ERROR_WEBSOCKET_BAD_FRAME_HEADER_MASK,	// Partially received frame header data mask
	RMT_ERROR_WEBSOCKET_RECEIVE_TIMEOUT,		// Timeout receiving frame header

	RMT_ERROR_ACCESSING_DELETED_THREADSAMPLER,	// The server has shutdown but the client is still calling into remotery
};


#ifdef __cplusplus
extern "C" {
#endif


// Can call remotery functions on a null pointer


enum rmtError rmt_Create(Remotery** remotery);
void rmt_Destroy(Remotery* rmt);

void rmt_LogText(Remotery* rmt, rmtPStr text);

void rmt_UpdateServer(Remotery* rmt);

rmtBool rmt_IsClientConnected(Remotery* rmt);

//
// 'hash_cache' stores a pointer to a sample name's hash value. Internally this is used to identify unique callstacks and it
// would be ideal that it's not recalculated each time the sample is used. This can be statically cached at the point
// of call or stored elsewhere when dynamic names are required.
//
// If 'hash_cache' is NULL then this call becomes more expensive, as it has to recalculate the hash of the name.
//
void rmt_BeginCPUSample(Remotery* rmt, rmtPStr name, rmtU32* hash_cache);

void rmt_EndCPUSample(Remotery* rmt);


#ifdef __cplusplus
}
#endif

#endif