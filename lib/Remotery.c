
#include "remotery.h"



/*
------------------------------------------------------------------------------------------------------------------------
   Compiler/Platform Detection and External Dependencies
------------------------------------------------------------------------------------------------------------------------
*/



#if defined(_MSC_VER)
	#define RMT_COMPILER_MSVC
#endif

#if defined(_WINDOWS) || defined(_WIN32)
	#define RMT_PLATFORM_WINDOWS
#elif defined(__linux__) || defined(__APPLE__)
	#define RMT_PLATFORM_POSIX
#endif


// Required CRT dependencies
#define RMT_USE_TINYCRT
#ifdef RMT_USE_TINYCRT

	#include <TinyCRT/TinyCRT.h>

	// Allows inclusion of winsock2.h without windows.h
	#include <TinyCRT/TinyWin.h>
	#include <sal.h>
	#include <specstrings.h>

#else

	#include <malloc.h>
	#include <assert.h>

#endif


#ifdef RMT_PLATFORM_WINDOWS
	#include <winsock2.h>
#endif


typedef unsigned int rmtBool;
#define RMT_TRUE ((rmtBool)1)
#define RMT_FALSE ((rmtBool)0)


typedef unsigned short rmtU16;



/*
------------------------------------------------------------------------------------------------------------------------
   Sockets TCP/IP Wrapper
------------------------------------------------------------------------------------------------------------------------
*/


typedef struct
{
	rmtError error_state;

	SOCKET socket;
} TCPSocket;


typedef struct
{
	rmtBool can_read;
	rmtBool can_write;
	rmtBool has_errors;
} TCPSocketStatus;


//
// Function prototypes
//
static void TCPSocket_Close(TCPSocket* tcp_socket);


static rmtError InitialiseNetwork()
{
	#ifdef RMT_PLATFORM_WINDOWS

		WSADATA wsa_data;
		if (WSAStartup(MAKEWORD(2, 2), &wsa_data))
			return RMT_ERROR_INITIALISE_NETWORK_FAILED;
		if (LOBYTE(wsa_data.wVersion) != 2 || HIBYTE(wsa_data.wVersion) != 2)
			return RMT_ERROR_INITIALISE_NETWORK_FAILED;

		return RMT_ERROR_NONE;

	#endif

	return RMT_ERROR_NONE;
}


static void ShutdownNetwork()
{
	#ifdef RMT_PLATFORM_WINDOWS
		WSACleanup();
	#endif
}


static TCPSocket* TCPSocket_Create()
{
	TCPSocket* tcp_socket = (TCPSocket*)malloc(sizeof(TCPSocket));
	if (tcp_socket == NULL)
		return NULL;
	tcp_socket->error_state = RMT_ERROR_NONE;
	tcp_socket->socket = INVALID_SOCKET;
	return tcp_socket;
}


static TCPSocket* TCPSocket_CreateServer(rmtU16 port)
{
	TCPSocket* tcp_socket = NULL;
	SOCKET s = INVALID_SOCKET;
	struct sockaddr_in sin = { 0 };
	u_long nonblock = 1;

	// Always try to allocate the socket container, even if later creation of its resources fails
	// Any errors are returned in the socket structure itself
	tcp_socket = TCPSocket_Create();
	if (tcp_socket == NULL)
		return NULL;
	tcp_socket->error_state = InitialiseNetwork();
	if (tcp_socket->error_state != RMT_ERROR_NONE)
		return tcp_socket;

	// Try to create the socket
	s = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
	if (s == SOCKET_ERROR)
	{
		tcp_socket->error_state = RMT_ERROR_CREATE_SOCKET_FAILED;
		return tcp_socket;
	}

	// Bind the socket to the incoming port
	sin.sin_family = AF_INET;
	sin.sin_addr.s_addr = INADDR_ANY;
	sin.sin_port = htons(port);
	if (bind(s, (struct sockaddr*)&sin, sizeof(sin)) == SOCKET_ERROR)
	{
		tcp_socket->error_state = RMT_ERROR_BIND_SOCKET_FAILED;
		closesocket(s);
		return tcp_socket;
	}

	// Connection is valid, remaining code is socket state modification
	tcp_socket->socket = s;

	// Enter a listening state with a backlog of 1 connection
	if (listen(s, 1) == SOCKET_ERROR)
	{
		tcp_socket->error_state = RMT_ERROR_LISTEN_SOCKET_FAILED;
		TCPSocket_Close(tcp_socket);
		return tcp_socket;
	}

	// Set as non-blocking
	if (ioctlsocket(tcp_socket->socket, FIONBIO, &nonblock) == SOCKET_ERROR)
	{
		tcp_socket->error_state = RMT_ERROR_SET_NON_BLOCKING_FAILED;
		TCPSocket_Close(tcp_socket);
		return tcp_socket;
	}

	return tcp_socket;
}


static void TCPSocket_Destroy(TCPSocket* tcp_socket)
{
	assert(tcp_socket != NULL);
	TCPSocket_Close(tcp_socket);
	free(tcp_socket);
}


static void TCPSocket_Close(TCPSocket* tcp_socket)
{
	assert(tcp_socket != NULL);

	if (tcp_socket->socket != INVALID_SOCKET)
	{
		// Shutdown the connection, stopping all sends
		int result = shutdown(tcp_socket->socket, SD_SEND);
		if (result != SOCKET_ERROR)
		{
			// Keep receiving until the peer closes the connection
			int total = 0;
			char temp_buf[128];
			while (result > 0)
			{
				result = recv(tcp_socket->socket, temp_buf, sizeof(temp_buf), 0);
				total += result;
			}
		}

		// Close the socket and issue a network shutdown request
		closesocket(tcp_socket->socket);
		tcp_socket->socket = INVALID_SOCKET;
		ShutdownNetwork();
	}
}


static TCPSocketStatus TCPSocket_PollStatus(TCPSocket* tcp_socket)
{
	TCPSocketStatus status;
	fd_set fd_read, fd_write, fd_errors;
	struct timeval tv;

	assert(tcp_socket != NULL);

	status.can_read = RMT_FALSE;
	status.can_write = RMT_FALSE;
	status.has_errors = RMT_FALSE;

	if (tcp_socket->socket == INVALID_SOCKET)
	{
		status.has_errors = RMT_TRUE;
		return status;
	}

	// Set read/write/error markers for the socket
	FD_ZERO(&fd_read);
	FD_ZERO(&fd_write);
	FD_ZERO(&fd_errors);
	FD_SET(tcp_socket->socket, &fd_read);
	FD_SET(tcp_socket->socket, &fd_write);
	FD_SET(tcp_socket->socket, &fd_errors);

	// Poll socket status without blocking
	tv.tv_sec = 0;
	tv.tv_usec = 0;
	if (select(0, &fd_read, &fd_write, &fd_errors, &tv) == SOCKET_ERROR)
	{
		status.has_errors = RMT_TRUE;
		return status;
	}

	status.can_read = FD_ISSET(tcp_socket->socket, &fd_read) != 0 ? RMT_TRUE : RMT_FALSE;
	status.can_write = FD_ISSET(tcp_socket->socket, &fd_write) != 0 ? RMT_TRUE : RMT_FALSE;
	status.has_errors = FD_ISSET(tcp_socket->socket, &fd_errors) != 0 ? RMT_TRUE : RMT_FALSE;
	return status;
}


TCPSocket* TCPSocket_AcceptConnection(TCPSocket* tcp_socket)
{
	TCPSocketStatus status;

	assert(tcp_socket != NULL);

	// Ensure there is an incoming connection
	status = TCPSocket_PollStatus(tcp_socket);
	if (status.has_errors || !status.can_read)
		return NULL;

	// Accept the connection
	SOCKET s = accept(tcp_socket->socket, 0, 0);
	if (s == SOCKET_ERROR)
	{
		tcp_socket->error_state = RMT_ERROR_ACCEPT_CONNECTION_FAILED;
		TCPSocket_Close(tcp_socket);
		return NULL;
	}

	// Create a client socket for the new connection
	TCPSocket* client_socket = TCPSocket_Create();
	if (client_socket == NULL)
	{
		tcp_socket->error_state = RMT_ERROR_MALLOC_SOCKET_FAILED;
		TCPSocket_Close(tcp_socket);
		return NULL;
	}
	client_socket->socket = s;

	return client_socket;
}


/*
------------------------------------------------------------------------------------------------------------------------
   Remotery
------------------------------------------------------------------------------------------------------------------------
*/


struct Remotery
{
	rmtError error_state;
};


Remotery* rmt_Create()
{
	Remotery* rmt = (Remotery*)malloc(sizeof(Remotery));
	rmt->error_state = RMT_ERROR_NONE;
	return rmt;
}


void rmt_Destroy(Remotery* rmt)
{
	assert(rmt != 0);
}