
#ifndef RMT_INCLUDED_H
#define RMT_INCLUDED_H


typedef struct Remotery Remotery;


enum rmtError
{
	RMT_ERROR_NONE,

	// Network TCP/IP socket errors
	RMT_ERROR_INITIALISE_NETWORK_FAILED,		// Network initialisation failure (e.g. on Win32, WSAStartup fails)
	RMT_ERROR_MALLOC_SOCKET_FAILED,				// Malloc call for server or client socket failed
	RMT_ERROR_CREATE_SOCKET_FAILED,				// Can't create a socket for connection to the remote viewer
	RMT_ERROR_BIND_SOCKET_FAILED,				// Can't bind a socket for the server
	RMT_ERROR_LISTEN_SOCKET_FAILED,				// Created server socket failed to enter a listen state
	RMT_ERROR_SET_NON_BLOCKING_FAILED,			// Created server socket failed to switch to a non-blocking state
	RMT_ERROR_SELECT_SOCKET_FAILED,				// Server failed to call select on socket
	RMT_ERROR_ACCEPT_CONNECTION_FAILED,			// Server failed to accept connection from client
	RMT_ERROR_SEND_SOCKET_FAILED,				// Unrecoverable error occured while client/server tried to send data
	RMT_ERROR_RECV_SOCKET_FAILED,				// Unrecoverable error occured while client/server tried to receive data

	// WebSocket server errors
	RMT_ERROR_MALLOC_WEBSOCKET_FAILED,			// Malloc call for server or client web socket failed
	RMT_ERROR_WS_HANDSHAKE_RECV_FAILED,			// WebSocket server failed to receive complete handshake data
	RMT_ERROR_WS_HANDSHAKE_RECV_TIMEOUT,		// WebSocket server timed out receving handshake data
	RMT_ERROR_WS_HANDSHAKE_NOT_GET,				// WebSocket server handshake failed, not HTTP GET
	RMT_ERROR_WS_HANDSHAKE_NO_VERSION,			// WebSocket server handshake failed, can't locate WebSocket version
	RMT_ERROR_WS_HANDSHAKE_BAD_VERSION,			// WebSocket server handshake failed, unsupported WebSocket version
	RMT_ERROR_WS_HANDSHAKE_NO_HOST,				// WebSocket server handshake failed, can't locate host
	RMT_ERROR_WS_HANDSHAKE_BAD_HOST,			// WebSocket server handshake failed, host is not allowed to connect
	RMT_ERROR_WS_HANDSHAKE_NO_KEY,				// WebSocket server handshake failed, can't locate WebSocket key
	RMT_ERROR_WS_HANDSHAKE_BAD_KEY,				// WebSocket server handshake failed, WebSocket key is ill-formed
	RMT_ERROR_WS_HANDSHAKE_STRING_FAIL,			// WebSocket server handshake failed, internal error, bad string code
	RMT_ERROR_WS_HANDSHAKE_SEND_TIMEOUT,		// WebSocket server handshake failed, error sending response string
	RMT_ERROR_WS_HANDSHAKE_SEND_FAILED,			// WebSocket server handshake failed, timeout sending response string

};


Remotery* rmt_Create();
void rmt_Destroy(Remotery* rmt);

#endif