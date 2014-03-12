
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
typedef unsigned int rmtU32;



/*
------------------------------------------------------------------------------------------------------------------------
   Platform-specific timers
------------------------------------------------------------------------------------------------------------------------
*/



//
// Get millisecond timer value that has only one guarantee: multiple calls are consistently comparable.
// On some platforms, even though this returns milliseconds, the timer may be far less accurate.
//
rmtU32 GetLowResTimer()
{
	#ifdef RMT_PLATFORM_WINDOWS
		return (rmtU32)GetTickCount();
	#endif
}



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


typedef enum
{
	SEND_SUCCESS,
	SEND_TIMEOUT,
	SEND_ERROR
} SendResult;


typedef enum
{
	// Safe
	RECV_SUCCESS,
	RECV_NODATA,

	// Unhealthy, probably requires a disconnect
	RECV_TIMEOUT,
	RECV_ERROR,
} RecvResult;


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

	// Refresh error state on each call
	assert(tcp_socket != NULL);
	tcp_socket->error_state = RMT_ERROR_NONE;

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
		tcp_socket->error_state = RMT_ERROR_SELECT_SOCKET_FAILED;
		status.has_errors = RMT_TRUE;
		return status;
	}

	status.can_read = FD_ISSET(tcp_socket->socket, &fd_read) != 0 ? RMT_TRUE : RMT_FALSE;
	status.can_write = FD_ISSET(tcp_socket->socket, &fd_write) != 0 ? RMT_TRUE : RMT_FALSE;
	status.has_errors = FD_ISSET(tcp_socket->socket, &fd_errors) != 0 ? RMT_TRUE : RMT_FALSE;
	return status;
}


static TCPSocket* TCPSocket_AcceptConnection(TCPSocket* tcp_socket)
{
	TCPSocketStatus status;
	SOCKET s;
	TCPSocket* client_socket;

	assert(tcp_socket != NULL);

	// Ensure there is an incoming connection
	status = TCPSocket_PollStatus(tcp_socket);
	if (status.has_errors || !status.can_read)
		return NULL;

	// Accept the connection
	s = accept(tcp_socket->socket, 0, 0);
	if (s == SOCKET_ERROR)
	{
		tcp_socket->error_state = RMT_ERROR_ACCEPT_CONNECTION_FAILED;
		TCPSocket_Close(tcp_socket);
		return NULL;
	}

	// Create a client socket for the new connection
	client_socket = TCPSocket_Create();
	if (client_socket == NULL)
	{
		tcp_socket->error_state = RMT_ERROR_MALLOC_SOCKET_FAILED;
		TCPSocket_Close(tcp_socket);
		return NULL;
	}
	client_socket->socket = s;

	return client_socket;
}


static SendResult TCPSocket_Send(TCPSocket* tcp_socket, const void* data, u32 length, u32 timeout_ms)
{
	TCPSocketStatus status;
	char* cur_data = NULL;
	char* end_data = NULL;
	rmtU32 start_ms = 0;
	rmtU32 cur_ms = 0;

	assert(tcp_socket != NULL);

	// Can't send if there are socket errors
	status = TCPSocket_PollStatus(tcp_socket);
	if (status.has_errors)
		return SEND_ERROR;
	if (!status.can_write)
		return SEND_TIMEOUT;

	cur_data = (char*)data;
	end_data = cur_data + length;

	start_ms = GetLowResTimer();
	while (cur_data < end_data)
	{
		// Attempt to send the remaining chunk of data
		int bytes_sent = send(tcp_socket->socket, cur_data, end_data - cur_data, 0);

		if (bytes_sent == SOCKET_ERROR || bytes_sent == 0)
		{
			// Close the connection if sending fails for any other reason other than blocking
			DWORD error = WSAGetLastError();
			if (error != WSAEWOULDBLOCK)
			{
				tcp_socket->error_state = RMT_ERROR_SEND_SOCKET_FAILED;
				TCPSocket_Close(tcp_socket);
				return SEND_ERROR;
			}

			// First check for tick-count overflow and reset, giving a slight hitch every 49.7 days
			cur_ms = GetLowResTimer();
			if (cur_ms < start_ms)
			{
				start_ms = cur_ms;
				continue;
			}

			//
			// Timeout can happen when:
			//
			//    1) endpoint is no longer there
			//    2) endpoint can't consume quick enough
			//    3) local buffers overflow
			//
			// As none of these are actually errors, we have to pass this timeout back to the caller.
			//
			// TODO: This strategy breaks down if a send partially completes and then times out!
			//
			if (cur_ms - start_ms > timeout_ms)
			{
				return SEND_TIMEOUT;
			}
		}
		else
		{
			// Jump over the data sent
			cur_data += bytes_sent;
		}
	}

	return SEND_SUCCESS;
}


RecvResult TCPSocket_Receive(TCPSocket* tcp_socket, void* data, u32 length, u32 timeout_ms)
{
	TCPSocketStatus status;
	char* cur_data = NULL;
	char* end_data = NULL;
	rmtU32 start_ms = 0;
	rmtU32 cur_ms = 0;

	assert(tcp_socket != NULL);

	// Ensure there is data to receive
	status = TCPSocket_PollStatus(tcp_socket);
	if (status.has_errors)
		return RECV_ERROR;
	if (!status.can_read)
		return RECV_NODATA;

	cur_data = (char*)data;
	end_data = cur_data + length;

	// Loop until all data has been received
	start_ms = GetLowResTimer();
	while (cur_data < end_data)
	{
		int bytes_received = recv(tcp_socket->socket, cur_data, end_data - cur_data, 0);
		if (bytes_received == SOCKET_ERROR || bytes_received == 0)
		{
			// Close the connection if receiving fails for any other reason other than blocking
			DWORD error = WSAGetLastError();
			if (error != WSAEWOULDBLOCK)
			{
				tcp_socket->error_state = RMT_ERROR_RECV_SOCKET_FAILED;
				TCPSocket_Close(tcp_socket);
				return RECV_ERROR;
			}

			// First check for tick-count overflow and reset, giving a slight hitch every 49.7 days
			cur_ms = GetLowResTimer();
			if (cur_ms < start_ms)
			{
				start_ms = cur_ms;
				continue;
			}

			//
			// Timeout can happen when:
			//
			//    1) data is delayed by sender
			//    2) sender fails to send a complete set of packets
			//
			// As not all of these scenarios are errors, we need to pass this information back to the caller.
			//
			// TODO: This strategy breaks down if a receive partially completes and then times out!
			//
			if (cur_ms - start_ms > timeout_ms)
			{
				return RECV_TIMEOUT;
			}
		}
		else
		{
			// Jump over the data received
			cur_data += bytes_received;
		}
	}

	return RECV_SUCCESS;
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