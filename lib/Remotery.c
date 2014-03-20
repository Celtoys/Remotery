
//
// TODO:
//
//    * There's lots of useless casting going on here that doesn't need to be done in C. I'm doing, however, because
//      I have clReflect scanning this as a C++ file.
//    * Support partial tree sending. This would help job systems that are difficult to explicitly break into frames.
//

#include "Remotery.h"



/*
------------------------------------------------------------------------------------------------------------------------
------------------------------------------------------------------------------------------------------------------------
   Compiler/Platform Detection and External Dependencies
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
#else defined(__APPLE__)
	#define RMT_PLATFORM_MACOS
	#define RMT_PLATFORM_POSIX
#endif


//
// Required CRT dependencies
//
#define RMT_USE_TINYCRT
#ifdef RMT_USE_TINYCRT

	#include <TinyCRT/TinyCRT.h>

	// Allows inclusion of winsock2.h without windows.h
	#include <TinyCRT/TinyWin.h>
	#include <sal.h>
	#include <specstrings.h>

	extern long __cdecl _InterlockedCompareExchange(long volatile*, long, long);
	#pragma intrinsic(_InterlockedCompareExchange)

#else

	#include <malloc.h>
	#include <assert.h>

	#if defined(RMT_PLATFORM_POSIX)
		#include <pthreads.h>
	#endif

#endif


#ifdef RMT_PLATFORM_WINDOWS
	#include <winsock2.h>
#endif



rmtU64 min(rmtS64 a, rmtS64 b)
{
	return a < b ? a : b;
}


rmtU64 max(rmtS64 a, rmtS64 b)
{
	return a > b ? a : b;
}



/*
------------------------------------------------------------------------------------------------------------------------
------------------------------------------------------------------------------------------------------------------------
   Platform-specific timers
------------------------------------------------------------------------------------------------------------------------
------------------------------------------------------------------------------------------------------------------------
*/



//
// Get millisecond timer value that has only one guarantee: multiple calls are consistently comparable.
// On some platforms, even though this returns milliseconds, the timer may be far less accurate.
//
static rmtU32 msTimer_Get()
{
	#ifdef RMT_PLATFORM_WINDOWS
		return (rmtU32)GetTickCount();
	#endif
}


//
// Micro-second accuracy high performance counter
//
typedef struct
{
	LARGE_INTEGER counter_start;
	double counter_scale;
} usTimer;


static void usTimer_Init(usTimer* timer)
{
	#if defined(RMT_PLATFORM_WINDOWS)
		LARGE_INTEGER performance_frequency;

		assert(timer != NULL);

		// Calculate the scale from performance counter to microseconds
		QueryPerformanceFrequency(&performance_frequency);
		timer->counter_scale = 1000000.0 / performance_frequency.QuadPart;

		// Record the offset for each read of the counter
		QueryPerformanceCounter(&timer->counter_start);
	#endif
}


static rmtU64 usTimer_Get(usTimer* timer)
{
	#if defined(RMT_PLATFORM_WINDOWS)
		LARGE_INTEGER performance_count;

		assert(timer != NULL);

		// Read counter and convert to microseconds
		QueryPerformanceCounter(&performance_count);
		return (rmtU64)((performance_count.QuadPart - timer->counter_start.QuadPart) * timer->counter_scale);
	#endif
}



/*
------------------------------------------------------------------------------------------------------------------------
------------------------------------------------------------------------------------------------------------------------
   Platform-specific threading
------------------------------------------------------------------------------------------------------------------------
------------------------------------------------------------------------------------------------------------------------
*/



#define TLS_INVALID_HANDLE 0xFFFFFFFF


static enum rmtError tlsAlloc(rmtU32* handle)
{
	assert(handle != NULL);

#if defined(RMT_PLATFORM_WINDOWS)

	*handle = (rmtU32)TlsAlloc();
	if (*handle == TLS_OUT_OF_INDEXES)
	{
		*handle = TLS_INVALID_HANDLE;
		return RMT_ERROR_TLS_ALLOC_FAIL;
	}

#elif defined(RMT_PLATFORM_POSIX)

	assert(sizeof(rmtU32) == sizeof(pthread_key_t));
	if (pthread_key_create((pthread_key_t*)handle, NULL) != 0)
	{
		*handle = TLS_INVALID_HANDLE;
		return RMT_ERROR_TLS_ALLOC_FAIL;
	}

#endif

	return RMT_ERROR_NONE;
}


static void tlsFree(rmtU32 handle)
{
	assert(handle != TLS_INVALID_HANDLE);

#if defined(RMT_PLATFORM_WINDOWS)

	TlsFree(handle);

#elif defined(RMT_PLATFORM_POSIX)

	pthread_key_delete((pthread_key_t)handle);

#endif
}


static void tlsSet(rmtU32 handle, void* value)
{
	assert(handle != TLS_INVALID_HANDLE);

#if defined(RMT_PLATFORM_WINDOWS)

	TlsSetValue(handle, value);

#elif defined(RMT_PLATFORM_POSIX)

	pthread_setspecific((pthread_key_t)handle, value);

#endif
}


static void* tlsGet(rmtU32 handle)
{
	assert(handle != TLS_INVALID_HANDLE);

#if defined(RMT_PLATFORM_WINDOWS)

	return TlsGetValue(handle);

#elif defined(RMT_PLATFORM_POSIX)

	return pthread_getspecific((pthread_key_t)handle);

#endif
}


static rmtBool CompareAndSwapPointer(long* volatile* ptr, long* old_ptr, long* new_ptr)
{
	#if defined(RMT_PLATFORM_WINDOWS)
		return _InterlockedCompareExchange((long volatile*)ptr, (long)new_ptr, (long)old_ptr) == (long)old_ptr ? RMT_TRUE : RMT_FALSE;
	#elif defined(RMT_PLATFORM_LINUX)
		return __sync_bool_compare_and_swap((long volatile*)ptr, (long)old_ptr, (long)new_ptr) ? RMT_TRUE : RMT_FALSE;
	#elif defined(RMT_PLATFORM_MACOS)
		return OSAtomicCompareAndSwapPtr((long)old_ptr, (long)new_ptr, (long volatile*)ptr) ? RMT_TRUE : RMT_FALSE;
	#endif
}



/*
------------------------------------------------------------------------------------------------------------------------
------------------------------------------------------------------------------------------------------------------------
   Safe C Library excerpts
   http://sourceforge.net/projects/safeclib/
------------------------------------------------------------------------------------------------------------------------
------------------------------------------------------------------------------------------------------------------------
*/



/*------------------------------------------------------------------
 *
 * November 2008, Bo Berry
 *
 * Copyright (c) 2008-2011 by Cisco Systems, Inc
 * All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person
 * obtaining a copy of this software and associated documentation
 * files (the "Software"), to deal in the Software without
 * restriction, including without limitation the rights to use,
 * copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following
 * conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 * OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT.  IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 * OTHER DEALINGS IN THE SOFTWARE.
 *------------------------------------------------------------------
 */


// NOTE: Microsoft also has its own version of these functions so I'm do some hacky PP to remove them
#define strnlen_s strnlen_s_safe_c


#define RSIZE_MAX_STR (4UL << 10)	/* 4KB */
#define RCNEGATE(x) x


#define EOK             ( 0 )
#define ESNULLP         ( 400 )       /* null ptr                    */
#define ESZEROL         ( 401 )       /* length is zero              */
#define ESLEMAX         ( 403 )       /* length exceeds max          */
#define ESOVRLP         ( 404 )       /* overlap undefined           */
#define ESNOSPC         ( 406 )       /* not enough space for s2     */
#define ESUNTERM        ( 407 )       /* unterminated string         */
#define ESNOTFND        ( 409 )       /* not found                   */

#ifndef _ERRNO_T_DEFINED
#define _ERRNO_T_DEFINED
typedef int errno_t;
#endif


typedef unsigned int rsize_t;


static rsize_t
strnlen_s (const char *dest, rsize_t dmax)
{
    rsize_t count;

    if (dest == NULL) {
        return RCNEGATE(0);
    }

    if (dmax == 0) {
        return RCNEGATE(0);
    }

    if (dmax > RSIZE_MAX_STR) {
        return RCNEGATE(0);
    }

    count = 0;
    while (*dest && dmax) {
        count++;
        dmax--;
        dest++;
    }

    return RCNEGATE(count);
}


static errno_t
strstr_s (char *dest, rsize_t dmax,
          const char *src, rsize_t slen, char **substring)
{
    rsize_t len;
    rsize_t dlen;
    int i;

    if (substring == NULL) {
        return RCNEGATE(ESNULLP);
    }
    *substring = NULL;

    if (dest == NULL) {
        return RCNEGATE(ESNULLP);
    }

    if (dmax == 0) {
        return RCNEGATE(ESZEROL);
    }

    if (dmax > RSIZE_MAX_STR) {
        return RCNEGATE(ESLEMAX);
    }

    if (src == NULL) {
        return RCNEGATE(ESNULLP);
    }

    if (slen == 0) {
        return RCNEGATE(ESZEROL);
    }

    if (slen > RSIZE_MAX_STR) {
        return RCNEGATE(ESLEMAX);
    }

    /*
     * src points to a string with zero length, or
     * src equals dest, return dest
     */
    if (*src == '\0' || dest == src) {
        *substring = dest;
        return RCNEGATE(EOK);
    }

    while (*dest && dmax) {
        i = 0;
        len = slen;
        dlen = dmax;

        while (src[i] && dlen) {

            /* not a match, not a substring */
            if (dest[i] != src[i]) {
                break;
            }

            /* move to the next char */
            i++;
            len--;
            dlen--;

            if (src[i] == '\0' || !len) {
                *substring = dest;
                return RCNEGATE(EOK);
            }
        }
        dest++;
        dmax--;
    }

    /*
     * substring was not found, return NULL
     */
    *substring = NULL;
    return RCNEGATE(ESNOTFND);
}


static errno_t
strncat_s (char *dest, rsize_t dmax, const char *src, rsize_t slen)
{
    rsize_t orig_dmax;
    char *orig_dest;
    const char *overlap_bumper;

    if (dest == NULL) {
        return RCNEGATE(ESNULLP);
    }

    if (src == NULL) {
        return RCNEGATE(ESNULLP);
    }

    if (slen > RSIZE_MAX_STR) {
        return RCNEGATE(ESLEMAX);
    }

    if (dmax == 0) {
        return RCNEGATE(ESZEROL);
    }

    if (dmax > RSIZE_MAX_STR) {
        return RCNEGATE(ESLEMAX);
    }

    /* hold base of dest in case src was not copied */
    orig_dmax = dmax;
    orig_dest = dest;

    if (dest < src) {
        overlap_bumper = src;

        /* Find the end of dest */
        while (*dest != '\0') {

            if (dest == overlap_bumper) {
                return RCNEGATE(ESOVRLP);
            }

            dest++;
            dmax--;
            if (dmax == 0) {
                return RCNEGATE(ESUNTERM);
            }
        }

        while (dmax > 0) {
            if (dest == overlap_bumper) {
                return RCNEGATE(ESOVRLP);
            }

            /*
             * Copying truncated before the source null is encountered
             */
            if (slen == 0) {
                *dest = '\0';
                return RCNEGATE(EOK);
            }

            *dest = *src;
            if (*dest == '\0') {
                return RCNEGATE(EOK);
            }

            dmax--;
            slen--;
            dest++;
            src++;
        }

    } else {
        overlap_bumper = dest;

        /* Find the end of dest */
        while (*dest != '\0') {

            /*
             * NOTE: no need to check for overlap here since src comes first
             * in memory and we're not incrementing src here.
             */
            dest++;
            dmax--;
            if (dmax == 0) {
                return RCNEGATE(ESUNTERM);
            }
        }

        while (dmax > 0) {
            if (src == overlap_bumper) {
                return RCNEGATE(ESOVRLP);
            }

            /*
             * Copying truncated
             */
            if (slen == 0) {
                *dest = '\0';
                return RCNEGATE(EOK);
            }

            *dest = *src;
            if (*dest == '\0') {
                return RCNEGATE(EOK);
            }

            dmax--;
            slen--;
            dest++;
            src++;
        }
    }

    /*
     * the entire src was not copied, so the string will be nulled.
     */
    return RCNEGATE(ESNOSPC);
}



/*
------------------------------------------------------------------------------------------------------------------------
------------------------------------------------------------------------------------------------------------------------
   Reusable Object Allocator
------------------------------------------------------------------------------------------------------------------------
------------------------------------------------------------------------------------------------------------------------
*/



//
// All objects that require free-list-backed allocation need to inherit from this type.
//
typedef struct ObjectLink
{
	struct ObjectLink* next;
} ObjectLink;


typedef struct
{
	// Size of objects to allocate
	rmtU32 object_size;

	// Number of objects in the free list
	rmtU32 nb_free;

	// Number of objects used by callers
	rmtU32 nb_inuse;

	// Total allocation count
	rmtU32 nb_allocated;

	ObjectLink* first_free;
} ObjectAllocator;


static enum rmtError ObjectAllocator_Create(ObjectAllocator** allocator, rmtU32 object_size)
{
	assert(allocator != NULL);
	*allocator = (ObjectAllocator*)malloc(sizeof(ObjectAllocator));
	if (*allocator == NULL)
		return RMT_ERROR_MALLOC_FAIL;

	(*allocator)->object_size = object_size;
	(*allocator)->nb_free = 0;
	(*allocator)->nb_inuse = 0;
	(*allocator)->nb_allocated = 0;
	(*allocator)->first_free = NULL;

	return RMT_ERROR_NONE;
}


static enum rmtError ObjectAllocator_Alloc(ObjectAllocator* allocator, void** object)
{
	assert(allocator != NULL);
	assert(object != NULL);

	// Allocate objects on-demand
	if (allocator->first_free == NULL)
	{
		*object = malloc(allocator->object_size);
		if (*object == NULL)
			return RMT_ERROR_MALLOC_FAIL;
		((ObjectLink*)(*object))->next = NULL;
		allocator->nb_allocated++;
	}
	else
	{
		// Or pull available ones from the free list
		ObjectLink* link = (ObjectLink*)allocator->first_free;
		allocator->first_free = (ObjectLink*)link->next;
		*object = link;
		allocator->nb_free--;
	}

	allocator->nb_inuse++;

	return RMT_ERROR_NONE;
}


static void ObjectAllocator_Free(ObjectAllocator* allocator, void* object)
{
	// Add back to the free-list
	assert(allocator != NULL);
	((ObjectLink*)object)->next = (struct ObjectLink*)allocator->first_free;
	allocator->first_free = (ObjectLink*)object;
	allocator->nb_inuse--;
	allocator->nb_free++;
}


static void ObjectAllocator_Destroy(ObjectAllocator* allocator)
{
	// Ensure everything has been released to the allocator
	assert(allocator->nb_inuse == 0);

	// Destroy all objects released to the allocator
	assert(allocator != NULL);
	while (allocator->first_free != NULL)
		ObjectAllocator_Free(allocator, allocator->first_free);
}



/*
------------------------------------------------------------------------------------------------------------------------
------------------------------------------------------------------------------------------------------------------------
   Dynamic Buffer
------------------------------------------------------------------------------------------------------------------------
------------------------------------------------------------------------------------------------------------------------
*/



typedef struct
{
	rmtU32 alloc_granularity;

	rmtU32 bytes_allocated;
	rmtU32 bytes_used;

	rmtU8* data;
} Buffer;


static enum rmtError Buffer_Create(Buffer** buffer, rmtU32 alloc_granularity)
{
	assert(buffer != NULL);

	// Allocate and set defaults as nothing allocated

	*buffer = (Buffer*)malloc(sizeof(Buffer));
	if (*buffer == NULL)
		return RMT_ERROR_MALLOC_FAIL;

	(*buffer)->alloc_granularity = alloc_granularity;
	(*buffer)->bytes_allocated = 0;
	(*buffer)->bytes_used = 0;
	(*buffer)->data = NULL;

	return RMT_ERROR_NONE;
}


static void Buffer_Destroy(Buffer* buffer)
{
	assert(buffer != NULL);

	if (buffer->data != NULL)
	{
		free(buffer->data);
		buffer->data = NULL;
	}

	free(buffer);
}


static enum rmtError Buffer_Write(Buffer* buffer, void* data, rmtU32 length)
{
	assert(buffer != NULL);

	// Reallocate the buffer on overflow
	if (buffer->bytes_used + length > buffer->bytes_allocated)
	{
		// Calculate size increase rounded up to the requested allocation granularity
		rmtU32 g = buffer->alloc_granularity;
		rmtU32 a = buffer->bytes_allocated + length;
		a = a + ((g - 1) - ((a - 1) % g));
		buffer->bytes_allocated = a;
		buffer->data = (rmtU8*)realloc(buffer->data, buffer->bytes_allocated);
		if (buffer->data == NULL)
			return RMT_ERROR_MALLOC_FAIL;
	}

	// Copy all bytes
	memcpy(buffer->data + buffer->bytes_used, data, length);
	buffer->bytes_used += length;

	// NULL terminate (if possible) for viewing in debug
	if (buffer->bytes_used < buffer->bytes_allocated)
		buffer->data[buffer->bytes_used] = 0;

	return RMT_ERROR_NONE;
}


static enum rmtError Buffer_WriteString(Buffer* buffer, rmtPStr string)
{
	assert(string != NULL);
	return Buffer_Write(buffer, (void*)string, strnlen_s(string, 2048));
}



/*
------------------------------------------------------------------------------------------------------------------------
------------------------------------------------------------------------------------------------------------------------
   Sockets TCP/IP Wrapper
------------------------------------------------------------------------------------------------------------------------
------------------------------------------------------------------------------------------------------------------------
*/


typedef struct
{
	SOCKET socket;
} TCPSocket;


typedef struct
{
	rmtBool can_read;
	rmtBool can_write;
	enum rmtError error_state;
} SocketStatus;


//
// Function prototypes
//
static void TCPSocket_Close(TCPSocket* tcp_socket);
static enum rmtError TCPSocket_Destroy(TCPSocket** tcp_socket, enum rmtError error);


static enum rmtError InitialiseNetwork()
{
	#ifdef RMT_PLATFORM_WINDOWS

		WSADATA wsa_data;
		if (WSAStartup(MAKEWORD(2, 2), &wsa_data))
			return RMT_ERROR_SOCKET_INIT_NETWORK_FAIL;
		if (LOBYTE(wsa_data.wVersion) != 2 || HIBYTE(wsa_data.wVersion) != 2)
			return RMT_ERROR_SOCKET_INIT_NETWORK_FAIL;

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


static enum rmtError TCPSocket_Create(TCPSocket** tcp_socket)
{
	enum rmtError error;
	
	assert(tcp_socket != NULL);

	// Allocate and initialise
	*tcp_socket = (TCPSocket*)malloc(sizeof(TCPSocket));
	if (*tcp_socket == NULL)
		return RMT_ERROR_MALLOC_FAIL;
	(*tcp_socket)->socket = INVALID_SOCKET;

	error = InitialiseNetwork();
	if (error != RMT_ERROR_NONE)
		return TCPSocket_Destroy(tcp_socket, error);

	return RMT_ERROR_NONE;
}


static enum rmtError TCPSocket_CreateServer(rmtU16 port, TCPSocket** tcp_socket)
{
	SOCKET s = INVALID_SOCKET;
	struct sockaddr_in sin = { 0 };
	u_long nonblock = 1;

	// Create socket container
	enum rmtError error = TCPSocket_Create(tcp_socket);
	if (error != RMT_ERROR_NONE)
		return error;

	// Try to create the socket
	s = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
	if (s == SOCKET_ERROR)
		return TCPSocket_Destroy(tcp_socket, RMT_ERROR_SOCKET_CREATE_FAIL);

	// Bind the socket to the incoming port
	sin.sin_family = AF_INET;
	sin.sin_addr.s_addr = INADDR_ANY;
	sin.sin_port = htons(port);
	if (bind(s, (struct sockaddr*)&sin, sizeof(sin)) == SOCKET_ERROR)
		return TCPSocket_Destroy(tcp_socket, RMT_ERROR_SOCKET_BIND_FAIL);

	// Connection is valid, remaining code is socket state modification
	(*tcp_socket)->socket = s;

	// Enter a listening state with a backlog of 1 connection
	if (listen(s, 1) == SOCKET_ERROR)
		return TCPSocket_Destroy(tcp_socket, RMT_ERROR_SOCKET_LISTEN_FAIL);

	// Set as non-blocking
	if (ioctlsocket((*tcp_socket)->socket, FIONBIO, &nonblock) == SOCKET_ERROR)
		return TCPSocket_Destroy(tcp_socket, RMT_ERROR_SOCKET_SET_NON_BLOCKING_FAIL);

	return RMT_ERROR_NONE;
}


static enum rmtError TCPSocket_Destroy(TCPSocket** tcp_socket, enum rmtError error)
{
	assert(tcp_socket != NULL);

	TCPSocket_Close(*tcp_socket);
	ShutdownNetwork();

	free(*tcp_socket);
	*tcp_socket = NULL;

	return error;
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
	}
}


static SocketStatus TCPSocket_PollStatus(TCPSocket* tcp_socket)
{
	SocketStatus status;
	fd_set fd_read, fd_write, fd_errors;
	struct timeval tv;

	status.can_read = RMT_FALSE;
	status.can_write = RMT_FALSE;
	status.error_state = RMT_ERROR_NONE;

	assert(tcp_socket != NULL);
	if (tcp_socket->socket == INVALID_SOCKET)
	{
		status.error_state = RMT_ERROR_SOCKET_INVALID_POLL;
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
		status.error_state = RMT_ERROR_SOCKET_SELECT_FAIL;
		return status;
	}

	status.can_read = FD_ISSET(tcp_socket->socket, &fd_read) != 0 ? RMT_TRUE : RMT_FALSE;
	status.can_write = FD_ISSET(tcp_socket->socket, &fd_write) != 0 ? RMT_TRUE : RMT_FALSE;
	status.error_state = FD_ISSET(tcp_socket->socket, &fd_errors) != 0 ? RMT_ERROR_SOCKET_POLL_ERRORS : RMT_ERROR_NONE;
	return status;
}


static enum rmtError TCPSocket_AcceptConnection(TCPSocket* tcp_socket, TCPSocket** client_socket)
{
	SocketStatus status;
	SOCKET s;
	enum rmtError error;

	// Ensure there is an incoming connection
	assert(tcp_socket != NULL);
	status = TCPSocket_PollStatus(tcp_socket);
	if (status.error_state != RMT_ERROR_NONE || !status.can_read)
		return status.error_state;

	// Accept the connection
	s = accept(tcp_socket->socket, 0, 0);
	if (s == SOCKET_ERROR)
	{
		TCPSocket_Close(tcp_socket);
		return RMT_ERROR_SOCKET_ACCEPT_FAIL;
	}

	// Create a client socket for the new connection
	assert(client_socket != NULL);
	error = TCPSocket_Create(client_socket);
	if (error != RMT_ERROR_NONE)
	{
		TCPSocket_Close(tcp_socket);
		return error;
	}
	(*client_socket)->socket = s;

	return RMT_ERROR_NONE;
}


static enum rmtError TCPSocket_Send(TCPSocket* tcp_socket, const void* data, rmtU32 length, rmtU32 timeout_ms)
{
	SocketStatus status;
	char* cur_data = NULL;
	char* end_data = NULL;
	rmtU32 start_ms = 0;
	rmtU32 cur_ms = 0;

	assert(tcp_socket != NULL);

	// Can't send if there are socket errors
	status = TCPSocket_PollStatus(tcp_socket);
	if (status.error_state != RMT_ERROR_NONE)
		return status.error_state;
	if (!status.can_write)
		return RMT_ERROR_SOCKET_SEND_TIMEOUT;

	cur_data = (char*)data;
	end_data = cur_data + length;

	start_ms = msTimer_Get();
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
				TCPSocket_Close(tcp_socket);
				return RMT_ERROR_SOCKET_SEND_FAIL;
			}

			// First check for tick-count overflow and reset, giving a slight hitch every 49.7 days
			cur_ms = msTimer_Get();
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
				return RMT_ERROR_SOCKET_SEND_TIMEOUT;
			}
		}
		else
		{
			// Jump over the data sent
			cur_data += bytes_sent;
		}
	}

	return RMT_ERROR_NONE;
}


static enum rmtError TCPSocket_Receive(TCPSocket* tcp_socket, void* data, rmtU32 length, rmtU32 timeout_ms)
{
	SocketStatus status;
	char* cur_data = NULL;
	char* end_data = NULL;
	rmtU32 start_ms = 0;
	rmtU32 cur_ms = 0;

	assert(tcp_socket != NULL);

	// Ensure there is data to receive
	status = TCPSocket_PollStatus(tcp_socket);
	if (status.error_state != RMT_ERROR_NONE)
		return status.error_state;
	if (!status.can_read)
		return RMT_ERROR_SOCKET_RECV_NO_DATA;

	cur_data = (char*)data;
	end_data = cur_data + length;

	// Loop until all data has been received
	start_ms = msTimer_Get();
	while (cur_data < end_data)
	{
		int bytes_received = recv(tcp_socket->socket, cur_data, end_data - cur_data, 0);
		if (bytes_received == SOCKET_ERROR || bytes_received == 0)
		{
			// Close the connection if receiving fails for any other reason other than blocking
			DWORD error = WSAGetLastError();
			if (error != WSAEWOULDBLOCK)
			{
				TCPSocket_Close(tcp_socket);
				return RMT_ERROR_SOCKET_RECV_FAILED;
			}

			// First check for tick-count overflow and reset, giving a slight hitch every 49.7 days
			cur_ms = msTimer_Get();
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
				return RMT_ERROR_SOCKET_RECV_TIMEOUT;
			}
		}
		else
		{
			// Jump over the data received
			cur_data += bytes_received;
		}
	}

	return RMT_ERROR_NONE;
}



/*
------------------------------------------------------------------------------------------------------------------------
------------------------------------------------------------------------------------------------------------------------
   SHA-1 Cryptographic Hash Function
------------------------------------------------------------------------------------------------------------------------
------------------------------------------------------------------------------------------------------------------------
*/


//
// Typed to allow enforced data size specification
//
typedef struct
{
	rmtU8 data[20];
} SHA1;


/*
 Copyright (c) 2011, Micael Hildenborg
 All rights reserved.

 Redistribution and use in source and binary forms, with or without
 modification, are permitted provided that the following conditions are met:
    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.
    * Neither the name of Micael Hildenborg nor the
      names of its contributors may be used to endorse or promote products
      derived from this software without specific prior written permission.

 THIS SOFTWARE IS PROVIDED BY Micael Hildenborg ''AS IS'' AND ANY
 EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 DISCLAIMED. IN NO EVENT SHALL Micael Hildenborg BE LIABLE FOR ANY
 DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

/*
 Contributors:
 Gustav
 Several members in the gamedev.se forum.
 Gregory Petrosyan
 */


// Rotate an integer value to left.
static unsigned int rol(const unsigned int value, const unsigned int steps)
{
	return ((value << steps) | (value >> (32 - steps)));
}


// Sets the first 16 integers in the buffert to zero.
// Used for clearing the W buffert.
static void clearWBuffert(unsigned int* buffert)
{
	int pos;
	for (pos = 16; --pos >= 0;)
	{
		buffert[pos] = 0;
	}
}

static void innerHash(unsigned int* result, unsigned int* w)
{
	unsigned int a = result[0];
	unsigned int b = result[1];
	unsigned int c = result[2];
	unsigned int d = result[3];
	unsigned int e = result[4];

	int round = 0;

	#define sha1macro(func,val) \
	{ \
		const unsigned int t = rol(a, 5) + (func) + e + val + w[round]; \
		e = d; \
		d = c; \
		c = rol(b, 30); \
		b = a; \
		a = t; \
	}

	while (round < 16)
	{
		sha1macro((b & c) | (~b & d), 0x5a827999)
		++round;
	}
	while (round < 20)
	{
		w[round] = rol((w[round - 3] ^ w[round - 8] ^ w[round - 14] ^ w[round - 16]), 1);
		sha1macro((b & c) | (~b & d), 0x5a827999)
		++round;
	}
	while (round < 40)
	{
		w[round] = rol((w[round - 3] ^ w[round - 8] ^ w[round - 14] ^ w[round - 16]), 1);
		sha1macro(b ^ c ^ d, 0x6ed9eba1)
		++round;
	}
	while (round < 60)
	{
		w[round] = rol((w[round - 3] ^ w[round - 8] ^ w[round - 14] ^ w[round - 16]), 1);
		sha1macro((b & c) | (b & d) | (c & d), 0x8f1bbcdc)
		++round;
	}
	while (round < 80)
	{
		w[round] = rol((w[round - 3] ^ w[round - 8] ^ w[round - 14] ^ w[round - 16]), 1);
		sha1macro(b ^ c ^ d, 0xca62c1d6)
		++round;
	}

	#undef sha1macro

	result[0] += a;
	result[1] += b;
	result[2] += c;
	result[3] += d;
	result[4] += e;
}


static void calc(const void* src, const int bytelength, unsigned char* hash)
{
	int roundPos;
	int lastBlockBytes;
	int hashByte;

	// Init the result array.
	unsigned int result[5] = { 0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0 };

	// Cast the void src pointer to be the byte array we can work with.
	const unsigned char* sarray = (const unsigned char*) src;

	// The reusable round buffer
	unsigned int w[80];

	// Loop through all complete 64byte blocks.
	const int endOfFullBlocks = bytelength - 64;
	int endCurrentBlock;
	int currentBlock = 0;

	while (currentBlock <= endOfFullBlocks)
	{
		endCurrentBlock = currentBlock + 64;

		// Init the round buffer with the 64 byte block data.
		for (roundPos = 0; currentBlock < endCurrentBlock; currentBlock += 4)
		{
			// This line will swap endian on big endian and keep endian on little endian.
			w[roundPos++] = (unsigned int) sarray[currentBlock + 3]
				| (((unsigned int) sarray[currentBlock + 2]) << 8)
				| (((unsigned int) sarray[currentBlock + 1]) << 16)
				| (((unsigned int) sarray[currentBlock]) << 24);
		}
		innerHash(result, w);
	}

	// Handle the last and not full 64 byte block if existing.
	endCurrentBlock = bytelength - currentBlock;
	clearWBuffert(w);
	lastBlockBytes = 0;
	for (;lastBlockBytes < endCurrentBlock; ++lastBlockBytes)
	{
		w[lastBlockBytes >> 2] |= (unsigned int) sarray[lastBlockBytes + currentBlock] << ((3 - (lastBlockBytes & 3)) << 3);
	}
	w[lastBlockBytes >> 2] |= 0x80 << ((3 - (lastBlockBytes & 3)) << 3);
	if (endCurrentBlock >= 56)
	{
		innerHash(result, w);
		clearWBuffert(w);
	}
	w[15] = bytelength << 3;
	innerHash(result, w);

	// Store hash in result pointer, and make sure we get in in the correct order on both endian models.
	for (hashByte = 20; --hashByte >= 0;)
	{
		hash[hashByte] = (result[hashByte >> 2] >> (((3 - hashByte) & 0x3) << 3)) & 0xff;
	}
}


static SHA1 SHA1_Calculate(const void* src, unsigned int length)
{
	SHA1 hash;
	assert((int)length >= 0);
	calc(src, length, hash.data);
	return hash;
}



/*
------------------------------------------------------------------------------------------------------------------------
------------------------------------------------------------------------------------------------------------------------
   Base-64 encoder
------------------------------------------------------------------------------------------------------------------------
------------------------------------------------------------------------------------------------------------------------
*/



static const char* b64_encoding_table =
		"ABCDEFGHIJKLMNOPQRSTUVWXYZ"
		"abcdefghijklmnopqrstuvwxyz"
		"0123456789+/";


static rmtU32 Base64_CalculateEncodedLength(rmtU32 length)
{
	// ceil(l * 4/3)
	return 4 * ((length + 2) / 3);
}


static void Base64_Encode(const rmtU8* in_bytes, rmtU32 length, rmtU8* out_bytes)
{
	rmtU32 i;
	rmtU32 encoded_length;
	rmtU32 remaining_bytes;

	rmtU8* optr = out_bytes;

	for (i = 0; i < length; )
	{
		// Read input 3 values at a time, null terminating
		rmtU32 c0 = i < length ? in_bytes[i++] : 0;
		rmtU32 c1 = i < length ? in_bytes[i++] : 0;
		rmtU32 c2 = i < length ? in_bytes[i++] : 0;

		// Encode 4 bytes for ever 3 input bytes
		rmtU32 triple = (c0 << 0x10) + (c1 << 0x08) + c2;
		*optr++ = b64_encoding_table[(triple >> 3 * 6) & 0x3F];
		*optr++ = b64_encoding_table[(triple >> 2 * 6) & 0x3F];
		*optr++ = b64_encoding_table[(triple >> 1 * 6) & 0x3F];
		*optr++ = b64_encoding_table[(triple >> 0 * 6) & 0x3F];
	}

	// Pad output to multiple of 3 bytes with terminating '='
	encoded_length = Base64_CalculateEncodedLength(length);
	remaining_bytes = (3 - ((length + 2) % 3)) - 1;
	for (i = 0; i < remaining_bytes; i++)
		out_bytes[encoded_length - 1 - i] = '=';

	// Null terminate
	out_bytes[encoded_length] = 0;
}



/*
------------------------------------------------------------------------------------------------------------------------
------------------------------------------------------------------------------------------------------------------------
   MurmurHash3
   https://code.google.com/p/smhasher
------------------------------------------------------------------------------------------------------------------------
------------------------------------------------------------------------------------------------------------------------
*/


//-----------------------------------------------------------------------------
// MurmurHash3 was written by Austin Appleby, and is placed in the public
// domain. The author hereby disclaims copyright to this source code.
//-----------------------------------------------------------------------------


static rmtU32 rotl32(rmtU32 x, rmtS8 r)
{
	return (x << r) | (x >> (32 - r));
}


// Block read - if your platform needs to do endian-swapping or can only
// handle aligned reads, do the conversion here
static rmtU32 getblock32(const rmtU32* p, int i)
{
	return p[i];
}


// Finalization mix - force all bits of a hash block to avalanche
static rmtU32 fmix32(rmtU32 h)
{
	h ^= h >> 16;
	h *= 0x85ebca6b;
	h ^= h >> 13;
	h *= 0xc2b2ae35;
	h ^= h >> 16;
	return h;
}


static rmtU32 MurmurHash3_x86_32(const void* key, int len, rmtU32 seed)
{
	const rmtU8* data = (const rmtU8*)key;
	const int nblocks = len / 4;

	rmtU32 h1 = seed;

	const rmtU32 c1 = 0xcc9e2d51;
	const rmtU32 c2 = 0x1b873593;

	int i;

	const rmtU32 * blocks = (const rmtU32 *)(data + nblocks*4);
	const rmtU8 * tail = (const rmtU8*)(data + nblocks*4);

	rmtU32 k1 = 0;

	//----------
	// body

	for (i = -nblocks; i; i++)
	{
		rmtU32 k1 = getblock32(blocks,i);

		k1 *= c1;
		k1 = rotl32(k1,15);
		k1 *= c2;

		h1 ^= k1;
		h1 = rotl32(h1,13); 
		h1 = h1*5+0xe6546b64;
	}

	//----------
	// tail

	switch(len & 3)
	{
	case 3: k1 ^= tail[2] << 16;
	case 2: k1 ^= tail[1] << 8;
	case 1: k1 ^= tail[0];
		k1 *= c1;
		k1 = rotl32(k1,15);
		k1 *= c2;
		h1 ^= k1;
	};

	//----------
	// finalization

	h1 ^= len;

	h1 = fmix32(h1);

	return h1;
} 



/*
------------------------------------------------------------------------------------------------------------------------
------------------------------------------------------------------------------------------------------------------------
   WebSockets
------------------------------------------------------------------------------------------------------------------------
------------------------------------------------------------------------------------------------------------------------
*/



enum WebSocketMode
{
	WEBSOCKET_NONE = 0,
	WEBSOCKET_TEXT = 1,
	WEBSOCKET_BINARY = 2,
};


typedef struct
{
	TCPSocket* tcp_socket;

	enum WebSocketMode mode;

	rmtU32 frame_bytes_remaining;
	rmtU32 mask_offset;

	rmtU8 data_mask[4];

	rmtU8* frame_data_cache;
	rmtU32 frame_data_cache_size;
} WebSocket;


static void WebSocket_Destroy(WebSocket* web_socket);


static char* GetField(char* buffer, rsize_t buffer_length, rmtPStr field_name)
{
	char* field = NULL;
	char* buffer_end = buffer + buffer_length - 1;

	rsize_t field_length = strnlen_s(field_name, buffer_length);
	if (field_length == 0)
		return NULL;

	// Search for the start of the field
	if (strstr_s(buffer, buffer_length, field_name, field_length, &field) != EOK)
		return NULL;

	// Field name is now guaranteed to be in the buffer so its safe to jump over it without hitting the bounds
	field += strlen(field_name);

	// Skip any trailing whitespace
	while (*field == ' ')
	{
		if (field >= buffer_end)
			return NULL;
		field++;
	}

	return field;
}


static const char websocket_guid[] = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
static const char websocket_response[] =
	"HTTP/1.1 101 Switching Protocols\r\n"
	"Upgrade: websocket\r\n"
	"Connection: Upgrade\r\n"
	"Sec-WebSocket-Accept: ";


static enum rmtError WebSocketHandshake(TCPSocket* tcp_socket, rmtPStr limit_host)
{
	rmtU32 start_ms, now_ms;

	// Parsing scratchpad
	char buffer[1024];
	char* buffer_ptr = buffer;
	int buffer_len = sizeof(buffer) - 1;
	char* buffer_end = buffer + buffer_len;

	char response_buffer[256];
	int response_buffer_len = sizeof(response_buffer) - 1;

	char* version;
	char* host;
	char* key;
	char* key_end;
	SHA1 hash;

	assert(tcp_socket != NULL);

	start_ms = msTimer_Get();

	// Really inefficient way of receiving the handshake data from the browser
	// Not really sure how to do this any better, as the termination requirement is \r\n\r\n
	while (buffer_ptr - buffer < buffer_len)
	{
		enum rmtError error = TCPSocket_Receive(tcp_socket, buffer_ptr, 1, 20);
		if (error == RMT_ERROR_SOCKET_RECV_FAILED)
			return error;

		// If there's a stall receiving the data, check for a handshake timeout
		if (error == RMT_ERROR_SOCKET_RECV_NO_DATA || error == RMT_ERROR_SOCKET_RECV_TIMEOUT)
		{
			now_ms = msTimer_Get();
			if (now_ms - start_ms > 1000)
				return RMT_ERROR_SOCKET_RECV_TIMEOUT;

			continue;
		}

		// Just in case new enums are added...
		assert(error == RMT_ERROR_NONE);

		if (buffer_ptr - buffer >= 4)
		{
			if (*(buffer_ptr - 3) == '\r' &&
				*(buffer_ptr - 2) == '\n' &&
				*(buffer_ptr - 1) == '\r' &&
				*(buffer_ptr - 0) == '\n')
				break;
		}

		buffer_ptr++;
	}
	*buffer_ptr = 0;

	// HTTP GET instruction
	if (memcmp(buffer, "GET", 3) != 0)
		return RMT_ERROR_WEBSOCKET_HANDSHAKE_NOT_GET;

	// Look for the version number and verify that it's supported
	version = GetField(buffer, buffer_len, "Sec-WebSocket-Version:");
	if (version == NULL)
		return RMT_ERROR_WEBSOCKET_HANDSHAKE_NO_VERSION;
	if (buffer_end - version < 2 || (version[0] != '8' && (version[0] != '1' || version[1] != '3')))
		return RMT_ERROR_WEBSOCKET_HANDSHAKE_BAD_VERSION;

	// Make sure this connection comes from a known host
	host = GetField(buffer, buffer_len, "Host:");
	if (host == NULL)
		return RMT_ERROR_WEBSOCKET_HANDSHAKE_NO_HOST;
	if (limit_host != NULL)
	{
		rsize_t limit_host_len = strnlen_s(limit_host, 128);
		char* found = NULL;
		if (strstr_s(host, buffer_end - host, limit_host, limit_host_len, &found) != EOK)
			return RMT_ERROR_WEBSOCKET_HANDSHAKE_BAD_HOST;
	}

	// Look for the key start and null-terminate it within the receive buffer
	key = GetField(buffer, buffer_len, "Sec-WebSocket-Key:");
	if (key == NULL)
		return RMT_ERROR_WEBSOCKET_HANDSHAKE_NO_KEY;
	if (strstr_s(key, buffer_end - key, "\r\n", 2, &key_end) != EOK)
		return RMT_ERROR_WEBSOCKET_HANDSHAKE_BAD_KEY;
	*key_end = 0;

	// Concatenate the browser's key with the WebSocket Protocol GUID and base64 encode
	// the hash, to prove to the browser that this is a bonafide WebSocket server
	buffer[0] = 0;
	if (strncat_s(buffer, buffer_len, key, key_end - key) != EOK)
		return RMT_ERROR_WEBSOCKET_HANDSHAKE_STRING_FAIL;
	if (strncat_s(buffer, buffer_len, websocket_guid, sizeof(websocket_guid)) != EOK)
		return RMT_ERROR_WEBSOCKET_HANDSHAKE_STRING_FAIL;
	hash = SHA1_Calculate(buffer, strnlen_s(buffer, buffer_len));
	Base64_Encode(hash.data, sizeof(hash.data), (rmtU8*)buffer);

	// Send the response back to the server with a longer timeout than usual
	response_buffer[0] = 0;
	if (strncat_s(response_buffer, response_buffer_len, websocket_response, sizeof(websocket_response)) != EOK)
		return RMT_ERROR_WEBSOCKET_HANDSHAKE_STRING_FAIL;
	if (strncat_s(response_buffer, response_buffer_len, buffer, buffer_len) != EOK)
		return RMT_ERROR_WEBSOCKET_HANDSHAKE_STRING_FAIL;
	if (strncat_s(response_buffer, response_buffer_len, "\r\n\r\n", 4) != EOK)
		return RMT_ERROR_WEBSOCKET_HANDSHAKE_STRING_FAIL;

	return TCPSocket_Send(tcp_socket, response_buffer, strnlen_s(response_buffer, response_buffer_len), 1000);
}


static enum rmtError WebSocket_Create(WebSocket** web_socket)
{
	*web_socket = (WebSocket*)malloc(sizeof(WebSocket));
	if (web_socket == NULL)
		return RMT_ERROR_MALLOC_FAIL;

	// Set default state
	(*web_socket)->tcp_socket = NULL;
	(*web_socket)->mode = WEBSOCKET_NONE;
	(*web_socket)->frame_bytes_remaining = 0;
	(*web_socket)->mask_offset = 0;
	(*web_socket)->data_mask[0] = 0;
	(*web_socket)->data_mask[1] = 0;
	(*web_socket)->data_mask[2] = 0;
	(*web_socket)->data_mask[3] = 0;
	(*web_socket)->frame_data_cache = NULL;
	(*web_socket)->frame_data_cache_size = 0;

	return RMT_ERROR_NONE;
}


static enum rmtError WebSocket_CreateServer(rmtU32 port, enum WebSocketMode mode, WebSocket** web_socket)
{
	enum rmtError error;

	assert(web_socket != NULL);

	error = WebSocket_Create(web_socket);
	if (error != RMT_ERROR_NONE)
		return error;

	(*web_socket)->mode = mode;

	// Create the server's listening socket
	error = TCPSocket_CreateServer(port, &(*web_socket)->tcp_socket);
	if (error != RMT_ERROR_NONE)
	{
		WebSocket_Destroy(*web_socket);
		*web_socket = NULL;
		return error;
	}

	return RMT_ERROR_NONE;
}


static void WebSocket_Close(WebSocket* web_socket)
{
	assert(web_socket != NULL);

	if (web_socket->frame_data_cache != NULL)
	{
		free(web_socket->frame_data_cache);
		web_socket->frame_data_cache = NULL;
	}

	if (web_socket->tcp_socket != NULL)
	{
		TCPSocket_Destroy(&web_socket->tcp_socket, RMT_ERROR_NONE);
		web_socket->tcp_socket = NULL;
	}
}


static void WebSocket_Destroy(WebSocket* web_socket)
{
	assert(web_socket != NULL);
	WebSocket_Close(web_socket);
	free(web_socket);
}


static SocketStatus WebSocket_PollStatus(WebSocket* web_socket)
{
	assert(web_socket != NULL);
	return TCPSocket_PollStatus(web_socket->tcp_socket);
}


static enum rmtError WebSocket_AcceptConnection(WebSocket* web_socket, WebSocket** client_socket)
{
	TCPSocket* tcp_socket = NULL;
	enum rmtError error;

	// Is there a waiting connection?
	assert(web_socket != NULL);
	error = TCPSocket_AcceptConnection(web_socket->tcp_socket, &tcp_socket);
	if (error != RMT_ERROR_NONE || tcp_socket == NULL)
		return error;

	// Need a successful handshake between client/server before allowing the connection
	// TODO: Specify limit_host
	error = WebSocketHandshake(tcp_socket, NULL);
	if (error != RMT_ERROR_NONE)
		return TCPSocket_Destroy(&tcp_socket, error);

	// Allocate and return a new client socket
	assert(client_socket != NULL);
	error = WebSocket_Create(client_socket);
	if (error != RMT_ERROR_NONE)
		return TCPSocket_Destroy(&tcp_socket, error);

	(*client_socket)->tcp_socket = tcp_socket;
	(*client_socket)->mode = web_socket->mode;

	return RMT_ERROR_NONE;
}


static void WriteSize(rmtU32 size, rmtU8* dest, rmtU32 dest_size, rmtU32 dest_offset)
{
	int size_size = dest_size - dest_offset;
	rmtU32 i;
	for (i = 0; i < dest_size; i++)
	{
		int j = i - dest_offset;
		dest[i] = (j < 0) ? 0 : (size >> ((size_size - j - 1) * 8)) & 0xFF;
	}
}


static enum rmtError WebSocket_Send(WebSocket* web_socket, const void* data, rmtU32 length, rmtU32 timeout_ms)
{
	SocketStatus status;
	rmtU8 final_fragment, frame_type, frame_header[10];
	rmtU32 frame_header_size, frame_size;

	assert(web_socket != NULL);

	// Can't send if there are socket errors
	status = WebSocket_PollStatus(web_socket);
	if (status.error_state != RMT_ERROR_NONE)
		return status.error_state;
	if (!status.can_write)
		return RMT_ERROR_SOCKET_SEND_TIMEOUT;

	final_fragment = 0x1 << 7;
	frame_type = (rmtU8)web_socket->mode;
	frame_header[0] = final_fragment | frame_type;

	// Construct the frame header, correctly applying the narrowest size
	frame_header_size = 0;
	if (length <= 125)
	{
		frame_header_size = 2;
		frame_header[1] = length;
	}
	else if (length <= 65535)
	{
		frame_header_size = 2 + 2;
		frame_header[1] = 126;
		WriteSize(length, frame_header + 2, 2, 0);
	}
	else
	{
		frame_header_size = 2 + 8;
		frame_header[1] = 127;
		WriteSize(length, frame_header + 2, 8, 4);
	}

	// Only reallocate the frame cache if its not big enough
	frame_size = frame_header_size + length;
	if (web_socket->frame_data_cache == NULL || frame_size > web_socket->frame_data_cache_size)
	{
		if (web_socket->frame_data_cache != NULL)
			free(web_socket->frame_data_cache);
		web_socket->frame_data_cache = (rmtU8*)malloc(frame_size);
		web_socket->frame_data_cache_size = frame_size;
	}

	// Copy in the header and data contiguously
	assert(data != NULL);
	memcpy(web_socket->frame_data_cache, frame_header, frame_header_size);
	memcpy(web_socket->frame_data_cache + frame_header_size, data, length);

	// Pass Send result onto the caller
	return TCPSocket_Send(web_socket->tcp_socket, web_socket->frame_data_cache, frame_size, timeout_ms);
}


static enum rmtError ReceiveFrameHeader(WebSocket* web_socket)
{
	// TODO: Specify infinite timeout?

	enum rmtError error;
	rmtU8 msg_header[2] = { 0, 0 };
	int msg_length, size_bytes_remaining, i;
	rmtBool mask_present;

	assert(web_socket != NULL);

	// Get message header
	error = TCPSocket_Receive(web_socket->tcp_socket, msg_header, 2, 20);
	if (error != RMT_ERROR_NONE)
		return error;

	// Check for WebSocket Protocol disconnect
	if (msg_header[0] == 0x88)
		return RMT_ERROR_WEBSOCKET_DISCONNECTED;

	// Check that the client isn't sending messages we don't understand
	if (msg_header[0] != 0x81 && msg_header[0] != 0x82)
		return RMT_ERROR_WEBSOCKET_BAD_FRAME_HEADER;

	// Get message length and check to see if it's a marker for a wider length
	msg_length = msg_header[1] & 0x7F;
	size_bytes_remaining = 0;
	switch (msg_length)
	{
		case 126: size_bytes_remaining = 2; break;
		case 127: size_bytes_remaining = 8; break;
	}

	if (size_bytes_remaining > 0)
	{
		// Receive the wider bytes of the length
		rmtU8 size_bytes[4];
		error = TCPSocket_Receive(web_socket->tcp_socket, size_bytes, size_bytes_remaining, 20);
		if (error != RMT_ERROR_NONE)
			return RMT_ERROR_WEBSOCKET_BAD_FRAME_HEADER_SIZE;

		// Calculate new length, MSB first
		msg_length = 0;
		for (i = 0; i < size_bytes_remaining; i++)
			msg_length |= size_bytes[i] << ((size_bytes_remaining - 1 - i) * 8);
	}

	// Receive any message data masks
	mask_present = (msg_header[1] & 0x80) != 0 ? RMT_TRUE : RMT_FALSE;
	if (mask_present)
	{
		error = TCPSocket_Receive(web_socket->tcp_socket, web_socket->data_mask, 4, 20);
		if (error != RMT_ERROR_NONE)
			return error;
	}

	web_socket->frame_bytes_remaining = msg_length;
	web_socket->mask_offset = 0;

	return RMT_ERROR_NONE;
}


static enum rmtError WebSocket_Receive(WebSocket* web_socket, void* data, rmtU32 length, rmtU32 timeout_ms)
{
	SocketStatus status;
	char* cur_data;
	char* end_data;
	rmtU32 start_ms, now_ms;
	rmtU32 bytes_to_read;
	enum rmtError error;

	assert(web_socket != NULL);

	// Ensure there is data to receive
	status = WebSocket_PollStatus(web_socket);
	if (status.error_state != RMT_ERROR_NONE)
		return status.error_state;
	if (!status.can_read)
		return RMT_ERROR_SOCKET_RECV_NO_DATA;

	cur_data = (char*)data;
	end_data = cur_data + length;

	start_ms = msTimer_Get();
	while (cur_data < end_data)
	{
		// Get next WebSocket frame if we've run out of data to read from the socket
		if (web_socket->frame_bytes_remaining == 0)
		{
			error = ReceiveFrameHeader(web_socket);
			if (error != RMT_ERROR_NONE)
			{
				// Frame header potentially partially received so need to close
				WebSocket_Close(web_socket);
				return error;
			}
		}

		// Read as much required data as possible
		bytes_to_read = web_socket->frame_bytes_remaining < length ? web_socket->frame_bytes_remaining : length;
		error = TCPSocket_Receive(web_socket->tcp_socket, cur_data, bytes_to_read, 20);
		if (error == RMT_ERROR_SOCKET_RECV_FAILED)
		{
			WebSocket_Close(web_socket);
			return error;
		}

		// If there's a stall receiving the data, check for timeout
		if (error == RMT_ERROR_SOCKET_RECV_NO_DATA || error == RMT_ERROR_SOCKET_RECV_TIMEOUT)
		{
			now_ms = msTimer_Get();
			if (now_ms - start_ms > timeout_ms)
				return RMT_ERROR_SOCKET_RECV_TIMEOUT;
			continue;
		}

		// Apply data mask
		if (*(rmtU32*)web_socket->data_mask != 0)
		{
			rmtU32 i;
			for (i = 0; i < bytes_to_read; i++)
			{
				*((rmtU8*)cur_data + i) ^= web_socket->data_mask[web_socket->mask_offset & 3];
				web_socket->mask_offset++;
			}
		}

		cur_data += bytes_to_read;
		web_socket->frame_bytes_remaining -= bytes_to_read;
	}

	return RMT_ERROR_NONE;
}



/*
------------------------------------------------------------------------------------------------------------------------
------------------------------------------------------------------------------------------------------------------------
   Network Server
------------------------------------------------------------------------------------------------------------------------
------------------------------------------------------------------------------------------------------------------------
*/



typedef struct
{
	WebSocket* listen_socket;

	WebSocket* client_socket;

	rmtU32 last_ping_time;
} Server;


static void Server_Destroy(Server* server);


static enum rmtError Server_Create(rmtU16 port, Server** server)
{
	enum rmtError error;

	assert(server != NULL);
	*server = (Server*)malloc(sizeof(Server));
	if (*server == NULL)
		return RMT_ERROR_MALLOC_FAIL;

	// Initialise defaults
	(*server)->listen_socket = NULL;
	(*server)->client_socket = NULL;
	(*server)->last_ping_time = 0;

	// Create the listening WebSocket
	error = WebSocket_CreateServer(port, WEBSOCKET_TEXT, &(*server)->listen_socket);
	if (error != RMT_ERROR_NONE)
	{
		Server_Destroy(*server);
		*server = NULL;
		return error;
	}

	return RMT_ERROR_NONE;
}


static void Server_Destroy(Server* server)
{
	assert(server != NULL);

	if (server->client_socket != NULL)
		WebSocket_Destroy(server->client_socket);
	if (server->listen_socket != NULL)
		WebSocket_Destroy(server->listen_socket);

	free(server);
}


static const char log_message[] = "{ \"id\": \"LOG\", \"text\": \"";


static void Server_LogText(Server* server, rmtPStr text)
{
	assert(server != NULL);
	if (server->client_socket != NULL)
	{
		int start_offset, prev_offset, i;

		// Start the line buffer off with the JSON message markup
		char line_buffer[1024] = { 0 };
		strncat_s(line_buffer, sizeof(line_buffer), log_message, sizeof(log_message));
		start_offset = strnlen_s(line_buffer, sizeof(line_buffer) - 1);

		// There might be newlines in the buffer, so split them into multiple network calls
		prev_offset = start_offset;
		for (i = 0; text[i] != 0; i++)
		{
			char c = text[i];

			// Line wrap when too long or newline encountered
			if (prev_offset == sizeof(line_buffer) - 3 || c == '\n')
			{
				// End message and send
				line_buffer[prev_offset++] = '\"';
				line_buffer[prev_offset++] = '}';
				line_buffer[prev_offset] = 0;
				WebSocket_Send(server->client_socket, line_buffer, prev_offset, 20);

				// Restart line
				prev_offset = start_offset;
			}

			// Safe to insert 2 characters here as previous check would split lines if not enough space left
			switch (c)
			{
				// Skip newline, dealt with above
				case '\n':
					break;

				// Escape these
				case '\\':
					line_buffer[prev_offset++] = '\\';
					line_buffer[prev_offset++] = '\\';
					break;

				case '\"':
					line_buffer[prev_offset++] = '\\';
					line_buffer[prev_offset++] = '\"';
					break;

				// Add the rest
				default:
					line_buffer[prev_offset++] = c;
					break;
			}
		}

		// Send the last line
		if (prev_offset > start_offset)
		{
			assert(prev_offset < sizeof(line_buffer) - 3);
			line_buffer[prev_offset++] = '\"';
			line_buffer[prev_offset++] = '}';
			line_buffer[prev_offset] = 0;
			WebSocket_Send(server->client_socket, line_buffer, prev_offset, 20);
		}
	}
}


static void Server_Update(Server* server)
{
	rmtU32 cur_time;

	assert(server != NULL);

	if (server->client_socket == NULL)
	{
		// Accept connections as long as there is no client connected
		WebSocket_AcceptConnection(server->listen_socket, &server->client_socket);
	}

	else
	{
		// Check for any incoming messages
		char message_first_byte;
		enum rmtError error = WebSocket_Receive(server->client_socket, &message_first_byte, 1, 0);
		if (error == RMT_ERROR_NONE)
		{
			// data available to read
		}
		else if (error == RMT_ERROR_SOCKET_RECV_NO_DATA)
		{
			// no data available
		}
		else if (error == RMT_ERROR_SOCKET_RECV_TIMEOUT)
		{
			// data not available yet, can afford to ignore as we're only reading the first byte
		}
		else
		{
			// Anything else is an error that may have closed the connection
			WebSocket_Destroy(server->client_socket);
			server->client_socket = NULL;
		}
	}

	if (server->client_socket != NULL)
	{
		// Send pings to the client every second
		cur_time = msTimer_Get();
		if (cur_time - server->last_ping_time > 1000)
		{
			rmtPStr ping_message = "{ \"id\": \"PING\" }";
			enum rmtError error = WebSocket_Send(server->client_socket, ping_message, strlen(ping_message), 20);
			if (error == RMT_ERROR_SOCKET_SEND_FAIL)
			{
				WebSocket_Destroy(server->client_socket);
				server->client_socket = NULL;
			}

			server->last_ping_time = cur_time;
		}
	}
}


static rmtBool Server_IsClientConnected(Server* server)
{
	assert(server != NULL);
	return server->client_socket != NULL ? RMT_TRUE : RMT_FALSE;
}


static enum rmtError Server_Send(Server* server, void* data, rmtU32 length, rmtU32 timeout)
{
	assert(server != NULL);
	if (Server_IsClientConnected(server))
		return WebSocket_Send(server->client_socket, data, length, timeout);
	return RMT_ERROR_NONE;
}



/*
------------------------------------------------------------------------------------------------------------------------
------------------------------------------------------------------------------------------------------------------------
   Basic, text-based JSON serialisation
------------------------------------------------------------------------------------------------------------------------
------------------------------------------------------------------------------------------------------------------------
*/



//
// Simple macro for hopefully making the serialisation a little clearer by hiding the error handling
//
#define JSON_ERROR_CHECK(stmt) error = stmt; if (error != RMT_ERROR_NONE) return error;



static enum rmtError json_OpenObject(Buffer* buffer)
{
	return Buffer_Write(buffer, (void*)"{", 1);
}


static enum rmtError json_CloseObject(Buffer* buffer)
{
	return Buffer_Write(buffer, (void*)"}", 1);
}


static enum rmtError json_Comma(Buffer* buffer)
{
	return Buffer_Write(buffer, (void*)",", 1);
}


static enum rmtError json_Colon(Buffer* buffer)
{
	return Buffer_Write(buffer, (void*)":", 1);
}


static enum rmtError json_String(Buffer* buffer, rmtPStr string)
{
	enum rmtError error;
	JSON_ERROR_CHECK(Buffer_Write(buffer, (void*)"\"", 1));
	JSON_ERROR_CHECK(Buffer_WriteString(buffer, string));
	return Buffer_Write(buffer, (void*)"\"", 1);
}


static enum rmtError json_FieldStr(Buffer* buffer, rmtPStr name, rmtPStr value)
{
	enum rmtError error;

	JSON_ERROR_CHECK(json_String(buffer, name));
	JSON_ERROR_CHECK(json_Colon(buffer));
	return json_String(buffer, value);
}


static enum rmtError json_FieldU64(Buffer* buffer, rmtPStr name, rmtU64 value)
{
	static char temp_buf[32];

	char* end;
	char* tptr;

	json_String(buffer, name);
	json_Colon(buffer);

	if (value == 0)
		return Buffer_Write(buffer, (void*)"0", 1);

	// Null terminate and start at the end
	end = temp_buf + sizeof(temp_buf) - 1;
	*end = 0;
	tptr = end;

	// Loop through the value with radix 10
	do
	{
		rmtU64 next_value = value / 10;
		*--tptr = (char)('0' + (value - next_value * 10));
		value = next_value;
	} while (value);

	return Buffer_Write(buffer, tptr, end - tptr);
}


static enum rmtError json_OpenArray(Buffer* buffer, rmtPStr name)
{
	enum rmtError error;

	JSON_ERROR_CHECK(json_String(buffer, name));
	JSON_ERROR_CHECK(json_Colon(buffer));
	return Buffer_Write(buffer, (void*)"[", 1);
}


static enum rmtError json_CloseArray(Buffer* buffer)
{
	return Buffer_Write(buffer, (void*)"]", 1);
}



/*
------------------------------------------------------------------------------------------------------------------------
------------------------------------------------------------------------------------------------------------------------
   CPU Sample Description
------------------------------------------------------------------------------------------------------------------------
------------------------------------------------------------------------------------------------------------------------
*/



typedef struct CPUSample
{
	// Inherit so that samples can be quickly allocated
	ObjectLink base;

	// Sample name and unique hash
	rmtPStr name;
	rmtU32 name_hash;

	// Unique, persistent ID among all samples
	rmtU32 unique_id;

	// Links to related samples in the tree
	struct CPUSample* parent;
	struct CPUSample* first_child;
	struct CPUSample* last_child;
	struct CPUSample* next_sibling;

	// Keep track of child count to distinguish from repeated calls to the same function at the same stack level
	// This is also mixed with the callstack hash to allow consistent addressing of any point in the tree
	rmtU32 nb_children;

	// Start and end of the sample in microseconds
	rmtU64 start_us;
	rmtU64 end_us;

} CPUSample;


static void CPUSample_SetDefaults(CPUSample* sample, rmtPStr name, rmtU32 name_hash, CPUSample* parent)
{
	sample->name = name;
	sample->name_hash = name_hash;
	sample->unique_id = 0;
	sample->parent = parent;
	sample->first_child = NULL;
	sample->last_child = NULL;
	sample->next_sibling = NULL;
	sample->nb_children = 0;
	sample->start_us = 0;
	sample->end_us = 0;
}


static enum rmtError json_CPUSampleArray(Buffer* buffer, CPUSample* first_sample, rmtPStr name);


static enum rmtError json_CPUSample(Buffer* buffer, CPUSample* sample)
{
	enum rmtError error;

	assert(sample != NULL);

	JSON_ERROR_CHECK(json_OpenObject(buffer));

		JSON_ERROR_CHECK(json_FieldStr(buffer, "name", sample->name));
		JSON_ERROR_CHECK(json_Comma(buffer));
		JSON_ERROR_CHECK(json_FieldU64(buffer, "cpu_us_start", sample->start_us));
		JSON_ERROR_CHECK(json_Comma(buffer));
		JSON_ERROR_CHECK(json_FieldU64(buffer, "cpu_us_length", max(sample->end_us - sample->start_us, 0)));

		if (sample->first_child != NULL)
		{
			JSON_ERROR_CHECK(json_Comma(buffer));
			JSON_ERROR_CHECK(json_CPUSampleArray(buffer, sample->first_child, "children"));
		}

	return json_CloseObject(buffer);
}


static enum rmtError json_CPUSampleArray(Buffer* buffer, CPUSample* first_sample, rmtPStr name)
{
	enum rmtError error;

	CPUSample* sample;

	JSON_ERROR_CHECK(json_OpenArray(buffer, name));

	for (sample = first_sample; sample != NULL; sample = sample->next_sibling)
	{
		JSON_ERROR_CHECK(json_CPUSample(buffer, sample));
		if (sample->next_sibling != NULL)
			JSON_ERROR_CHECK(json_Comma(buffer));
	}

	return json_CloseArray(buffer);
}



/*
------------------------------------------------------------------------------------------------------------------------
------------------------------------------------------------------------------------------------------------------------
   Per-Thread Sampler
------------------------------------------------------------------------------------------------------------------------
------------------------------------------------------------------------------------------------------------------------
*/



typedef struct ThreadSampler
{
	// Sample allocator for all samples in this thread
	ObjectAllocator* sample_allocator;

	// Root sample for all samples created by this thread
	CPUSample* root_sample;

	// Most recently pushed sample
	CPUSample* current_parent_sample;

	// Microsecond accuracy timer for CPU timestamps
	usTimer timer;

	// A dynamically-sized buffer used for encoding the sample tree as JSON and sending to the client
	Buffer* json_buf;

	// Next in the global list of active thread samplers
	struct ThreadSampler* volatile next;
} ThreadSampler;


struct Remotery
{
	Server* server;

	rmtU32 thread_sampler_tls_handle;

	// Linked list of all known threads being sampled
	ThreadSampler* volatile first_thread_sampler;
};


static void ThreadSampler_Destroy(ThreadSampler* ts);


static enum rmtError ThreadSampler_Get(Remotery* rmt, ThreadSampler** thread_sampler)
{
	ThreadSampler* ts;

	// Is there a thread sampler associated with this thread yet?
	assert(rmt != NULL);
	ts = (ThreadSampler*)tlsGet(rmt->thread_sampler_tls_handle);
	if (ts == NULL)
	{
		enum rmtError error;

		// Allocate on-demand
		ts = (ThreadSampler*)malloc(sizeof(ThreadSampler));
		if (ts == NULL)
			return RMT_ERROR_MALLOC_FAIL;

		// Set defaults
		ts->sample_allocator = NULL;
		ts->root_sample = NULL;
		ts->current_parent_sample = NULL;
		ts->json_buf = NULL;
		ts->next = NULL;

		// Create the sample allocator
		error = ObjectAllocator_Create(&ts->sample_allocator, sizeof(CPUSample));
		if (error != RMT_ERROR_NONE)
		{
			ThreadSampler_Destroy(ts);
			return error;
		}

		// Create a root sample that's around for the lifetime of the thread
		error = ObjectAllocator_Alloc(ts->sample_allocator, (void**)&ts->root_sample);
		if (error != RMT_ERROR_NONE)
		{
			ThreadSampler_Destroy(ts);
			return error;
		}
		CPUSample_SetDefaults(ts->root_sample, "<Root Sample>", 0, NULL);
		ts->current_parent_sample = ts->root_sample;

		// Kick-off the timer
		usTimer_Init(&ts->timer);

		// Create the JSON serialisation buffer
		error = Buffer_Create(&ts->json_buf, 4096);
		if (error != RMT_ERROR_NONE)
		{
			ThreadSampler_Destroy(ts);
			return error;
		}

		// Add to the beginning of the global linked list of thread samplers
		while (1)
		{
			ThreadSampler* old_ts = rmt->first_thread_sampler;
			ts->next = old_ts;

			// If the old value is what we expect it to be then no other thread has
			// changed it since this thread sampler was used as a candidate first list item
			if (CompareAndSwapPointer((long* volatile*)&rmt->first_thread_sampler, (long*)old_ts, (long*)ts) == RMT_TRUE)
				break;
		}

		tlsSet(rmt->thread_sampler_tls_handle, ts);
	}

	assert(thread_sampler != NULL);
	*thread_sampler = ts;
	return RMT_ERROR_NONE;
}


static void ThreadSampler_Destroy(ThreadSampler* ts)
{
	assert(ts != NULL);

	if (ts->json_buf != NULL)
	{
		Buffer_Destroy(ts->json_buf);
		ts->json_buf = NULL;
	}

	if (ts->root_sample != NULL)
	{
		ObjectAllocator_Free(ts->sample_allocator, ts->root_sample);
		ts->root_sample = NULL;
	}

	if (ts->sample_allocator != NULL)
	{
		ObjectAllocator_Destroy(ts->sample_allocator);
		ts->sample_allocator = NULL;
	}

	free(ts);
}


static void ThreadSampler_DestroyAll(Remotery* rmt)
{
	// If the handle failed to create in the first place then it shouldn't be possible to create thread samplers
	assert(rmt != NULL);
	if (rmt->thread_sampler_tls_handle == TLS_INVALID_HANDLE)
	{
		assert(rmt->first_thread_sampler == NULL);
		return;
	}

	// Keep popping thread samplers off the linked list until they're all gone
	// This does not make any assumptions, making it possible for thread samplers to be created while they're all
	// deleted. While this is erroneous calling code, this will prevent a confusing crash.
	while (rmt->first_thread_sampler != NULL)
	{
		ThreadSampler* ts;

		while (1)
		{
			ThreadSampler* old_ts = rmt->first_thread_sampler;
			ThreadSampler* next_ts = old_ts->next;

			if (CompareAndSwapPointer((long* volatile*)&rmt->first_thread_sampler, (long*)old_ts, (long*)next_ts) == RMT_TRUE)
			{
				ts = old_ts;
				break;
			}
		}

		// Release the thread sampler
		ThreadSampler_Destroy(ts);
	}
}


static enum rmtError ThreadSampler_Push(ThreadSampler* ts, rmtPStr name, rmtU32 name_hash, CPUSample** sample)
{
	CPUSample* parent;
	enum rmtError error;
	rmtU32 hash_src[3];

	// As each thread has a root sample node allocated, a parent must always be present
	assert(ts->current_parent_sample != NULL);
	parent = ts->current_parent_sample;

	if (parent->last_child != NULL && parent->last_child->name_hash == name_hash)
	{
		// TODO: Collapse siblings with flag exception?
	}
	if (parent->name_hash == name_hash)
	{
		// TODO: Collapse recursion on flag?
	}

	// Allocate a new sample
	assert(ts != NULL);
	error = ObjectAllocator_Alloc(ts->sample_allocator, (void**)sample);
	if (error != RMT_ERROR_NONE)
		return error;
	CPUSample_SetDefaults(*sample, name, name_hash, parent);

	// Generate a unique ID for this sample in the tree
	hash_src[0] = parent->name_hash;
	hash_src[1] = parent->nb_children;
	hash_src[2] = (*sample)->name_hash;
	(*sample)->unique_id = MurmurHash3_x86_32(hash_src, sizeof(hash_src), 0);

	// Add sample to its parent
	parent->nb_children++;
	if (parent->first_child == NULL)
	{
		parent->first_child = *sample;
		parent->last_child = *sample;
	}
	else
	{
		assert(parent->last_child != NULL);
		parent->last_child->next_sibling = *sample;
		parent->last_child = *sample;
	}

	// Make this sample the new parent of any newly created samples
	ts->current_parent_sample = *sample;

	return RMT_ERROR_NONE;
}


static void ThreadSampler_Pop(ThreadSampler* ts, CPUSample* sample)
{
	assert(ts != NULL);
	assert(sample != NULL);
	assert(sample != ts->root_sample);
	ts->current_parent_sample = sample->parent;
}


static void ThreadSampler_FreeSample(ThreadSampler* ts, CPUSample* sample, rmtBool just_contents)
{
	CPUSample* child;

	assert(ts != NULL);
	assert(sample != NULL);

	// Free children first
	for (child = sample->first_child; child != NULL; child = child->next_sibling)
		ThreadSampler_FreeSample(ts, child, RMT_FALSE);

	// Clear child info
	sample->first_child = NULL;
	sample->last_child = NULL;
	sample->nb_children = 0;

	// Only free the sample if requested
	if (just_contents == RMT_FALSE)
		ObjectAllocator_Free(ts->sample_allocator, sample);
}


static enum rmtError ThreadSampler_SendSamples(ThreadSampler* ts, Server* server)
{
	enum rmtError error;

	Buffer* buffer;

	assert(ts != NULL);

	// Don't support partial sending of the tree (yet?)
	if (ts->current_parent_sample != ts->root_sample)
		return RMT_ERROR_SEND_ON_INCOMPLETE_PROFILE;

	// Reset the buffer position to the start
	buffer = ts->json_buf;
	buffer->bytes_used = 0;

	// Start at the root sample but only send its child array, ignoring its description
	JSON_ERROR_CHECK(json_OpenObject(buffer));

		JSON_ERROR_CHECK(json_FieldStr(buffer, "id", "SAMPLES"));
		JSON_ERROR_CHECK(json_Comma(buffer));
		JSON_ERROR_CHECK(json_FieldStr(buffer, "thread_name", "UNNAMED"));
		JSON_ERROR_CHECK(json_Comma(buffer));
		JSON_ERROR_CHECK(json_CPUSampleArray(buffer, ts->root_sample->first_child, "samples"));

	JSON_ERROR_CHECK(json_CloseObject(buffer));

	return Server_Send(server, buffer->data, buffer->bytes_used, 20);
}



/*
------------------------------------------------------------------------------------------------------------------------
------------------------------------------------------------------------------------------------------------------------
   Remotery
------------------------------------------------------------------------------------------------------------------------
------------------------------------------------------------------------------------------------------------------------
*/



enum rmtError rmt_Create(Remotery** remotery)
{
	enum rmtError error;

	assert(remotery != NULL);

	*remotery = (Remotery*)malloc(sizeof(Remotery));
	if (*remotery == NULL)
		return RMT_ERROR_MALLOC_FAIL;

	// Set default state
	(*remotery)->server = NULL;
	(*remotery)->thread_sampler_tls_handle = TLS_INVALID_HANDLE;
	(*remotery)->first_thread_sampler = NULL;

	// Allocate a TLS handle for the thread sampler
	error = tlsAlloc(&(*remotery)->thread_sampler_tls_handle);
	if (error != RMT_ERROR_NONE)
	{
		rmt_Destroy(*remotery);
		*remotery = NULL;
		return error;
	}

	// Create the server
	error = Server_Create(0x4597, &(*remotery)->server);
	if (error != RMT_ERROR_NONE)
	{
		rmt_Destroy(*remotery);
		*remotery = NULL;
		return error;
	}

	return RMT_ERROR_NONE;
}


void rmt_Destroy(Remotery* rmt)
{
	if (rmt == NULL)
		return;

	ThreadSampler_DestroyAll(rmt);

	if (rmt->server != NULL)
	{
		Server_Destroy(rmt->server);
		rmt->server = NULL;
	}

	if (rmt->thread_sampler_tls_handle != TLS_INVALID_HANDLE)
	{
		tlsFree(rmt->thread_sampler_tls_handle);
		rmt->thread_sampler_tls_handle = NULL;
	}

	free(rmt);
}


void rmt_LogText(Remotery* rmt, rmtPStr text)
{
	if (rmt != NULL)
		Server_LogText(rmt->server, text);
}


void rmt_UpdateServer(Remotery* rmt)
{
	if (rmt != NULL)
		Server_Update(rmt->server);
}


rmtBool rmt_IsClientConnected(Remotery* rmt)
{
	if (rmt != NULL)
		return Server_IsClientConnected(rmt->server);
	return RMT_FALSE;
}


rmtU32 GetNameHash(rmtPStr name, rmtU32* hash_cache)
{
	// Hash cache provided?
	if (hash_cache != NULL)
	{
		// Calculate the hash first time round only
		if (*hash_cache == 0)
		{
			assert(name != NULL);
			*hash_cache = MurmurHash3_x86_32(name, strnlen_s(name, 256), 0);
		}

		return *hash_cache;
	}

	// Have to recalculate every time when no cache storage exists
	return MurmurHash3_x86_32(name, strnlen_s(name, 256), 0);
}


void rmt_BeginCPUSample(Remotery* rmt, rmtPStr name, rmtU32* hash_cache)
{
	rmtU32 name_hash = 0;
	ThreadSampler* ts;
	CPUSample* sample;

	if (rmt == NULL)
		return;

	// Get data for this thread
	// TODO: Should we use RegisterThread instead? That would increase API init burden but would prevent the need
	// to return error codes for all API functions.
	if (ThreadSampler_Get(rmt, &ts) != RMT_ERROR_NONE)
		return;

	name_hash = GetNameHash(name, hash_cache);

	// TODO: Time how long the bits outside here cost and subtract them from the parent

	if (ThreadSampler_Push(ts, name, name_hash, &sample) != RMT_ERROR_NONE)
		return;

	sample->start_us = usTimer_Get(&ts->timer);
}


void rmt_EndCPUSample(Remotery* rmt)
{
	ThreadSampler* ts;
	CPUSample* sample;

	if (rmt == NULL)
		return;

	// Get data for this thread
	if (ThreadSampler_Get(rmt, &ts) != RMT_ERROR_NONE)
		return;

	sample = ts->current_parent_sample;
	sample->end_us = usTimer_Get(&ts->timer);

	ThreadSampler_Pop(ts, sample);
}


enum rmtError rmt_SendThreadSamples(Remotery* rmt)
{
	ThreadSampler* ts;
	enum rmtError error;

	if (rmt == NULL)
		return RMT_ERROR_REMOTERY_NOT_CREATED;

	// Get data for this thread
	error = ThreadSampler_Get(rmt, &ts);
	if (error != RMT_ERROR_NONE)
		return error;

	// Having a client not connected is typical and not an error
	if (Server_IsClientConnected(rmt->server))
    {
        error = ThreadSampler_SendSamples(ts, rmt->server);
        if (error != RMT_ERROR_NONE)
		  return error;
    }

    // Free all CPU samples except for this root one
    ThreadSampler_FreeSample(ts, ts->root_sample, RMT_TRUE);

	return RMT_ERROR_NONE;
}

