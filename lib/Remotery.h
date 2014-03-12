
#ifndef RMT_INCLUDED_H
#define RMT_INCLUDED_H


typedef struct Remotery Remotery;


typedef enum
{
	RMT_ERROR_NONE,

	// Network connection errors
	RMT_ERROR_INITIALISE_NETWORK_FAILED,		// Network initialisation failure (e.g. on Win32, WSAStartup fails)
	RMT_ERROR_CREATE_SOCKET_FAILED,				// Can't create a socket for connection to the remote viewer
	RMT_ERROR_BIND_SOCKET_FAILED,				// Can't bind a socket for the server
	RMT_ERROR_LISTEN_SOCKET_FAILED,				// Created server socket failed to enter a listen state
	RMT_ERROR_SET_NON_BLOCKING_FAILED,			// Created server socket failed to switch to a non-blocking state

} rmtError;


Remotery* rmt_Create();
void rmt_Destroy(Remotery* rmt);

#endif