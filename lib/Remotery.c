
#include "remotery.h"



/*
------------------------------------------------------------------------------------------------------------------------
------------------------------------------------------------------------------------------------------------------------
   Compiler/Platform Detection and External Dependencies
------------------------------------------------------------------------------------------------------------------------
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


typedef unsigned char rmtU8;
typedef unsigned short rmtU16;
typedef unsigned int rmtU32;



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
rmtU32 GetLowResTimer()
{
	#ifdef RMT_PLATFORM_WINDOWS
		return (rmtU32)GetTickCount();
	#endif
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
	enum rmtError error_state;

	SOCKET socket;
} TCPSocket;


typedef struct
{
	rmtBool can_read;
	rmtBool can_write;
	rmtBool has_errors;
} TCPSocketStatus;


typedef enum SendResult
{
	SEND_SUCCESS,
	SEND_TIMEOUT,
	SEND_ERROR
} SendResult;


typedef enum RecvResult
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


static SendResult TCPSocket_Send(TCPSocket* tcp_socket, const void* data, rmtU32 length, rmtU32 timeout_ms)
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


RecvResult TCPSocket_Receive(TCPSocket* tcp_socket, void* data, rmtU32 length, rmtU32 timeout_ms)
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


rmtU32 Base64_CalculateEncodedLength(rmtU32 length)
{
	// ceil(l * 4/3)
	return 4 * ((length + 2) / 3);
}


void Base64_Encode(const rmtU8* in_bytes, rmtU32 length, rmtU8* out_bytes)
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


rsize_t
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


errno_t
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


errno_t
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
   WebSocket Server
------------------------------------------------------------------------------------------------------------------------
------------------------------------------------------------------------------------------------------------------------
*/



static char* GetField(char* buffer, rsize_t buffer_length, const char* field_name)
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


static rmtError WebSocketHandshake(TCPSocket* tcp_socket, const char* limit_host)
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

	start_ms = GetLowResTimer();

	// Really inefficient way of receiving the handshake data from the browser
	// Not really sure how to do this any better, as the termination requirement is \r\n\r\n
	while (buffer_ptr - buffer < buffer_len)
	{
		RecvResult result = TCPSocket_Receive(tcp_socket, buffer_ptr, 1, 20);
		if (result == RECV_ERROR)
			return RMT_ERROR_WS_HANDSHAKE_RECV_FAILED;

		// If there's a stall receiving the data, check for a handshake timeout
		if (result == RECV_NODATA || result == RECV_TIMEOUT)
		{
			now_ms = GetLowResTimer();
			if (now_ms - start_ms > 1000)
				return RMT_ERROR_WS_HANDSHAKE_RECV_TIMEOUT;

			continue;
		}

		// Just in case new enums are added...
		assert(result == RECV_SUCCESS);

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
		return RMT_ERROR_WS_HANDSHAKE_NOT_GET;

	// Look for the version number and verify that it's supported
	version = GetField(buffer, buffer_len, "Sec-WebSocket-Version:");
	if (version == NULL)
		return RMT_ERROR_WS_HANDSHAKE_NO_VERSION;
	if (buffer_end - version < 2 || (version[0] != '8' && (version[0] != '1' || version[1] != '3')))
		return RMT_ERROR_WS_HANDSHAKE_BAD_VERSION;

	// Make sure this connection comes from a known host
	host = GetField(buffer, buffer_len, "Host:");
	if (host == NULL)
		return RMT_ERROR_WS_HANDSHAKE_NO_HOST;
	if (limit_host != NULL)
	{
		rsize_t limit_host_len = strnlen_s(limit_host, 128);
		char* found = NULL;
		if (strstr_s(host, buffer_end - host, limit_host, limit_host_len, &found) != EOK)
			return RMT_ERROR_WS_HANDSHAKE_BAD_HOST;
	}

	// Look for the key start and null-terminate it within the receive buffer
	key = GetField(buffer, buffer_len, "Sec-WebSocket-Key:");
	if (key == NULL)
		return RMT_ERROR_WS_HANDSHAKE_NO_KEY;
	if (strstr_s(key, buffer_end - key, "\r\n", 2, &key_end) != EOK)
		return RMT_ERROR_WS_HANDSHAKE_BAD_KEY;
	*key_end = 0;

	// Concatenate the browser's key with the WebSocket Protocol GUID and base64 encode
	// the hash, to prove to the browser that this is a bonafide WebSocket server
	buffer[0] = 0;
	if (strncat_s(buffer, buffer_len, key, key_end - key) != EOK)
		return RMT_ERROR_WS_HANDSHAKE_STRING_FAIL;
	if (strncat_s(buffer, buffer_len, websocket_guid, sizeof(websocket_guid)) != EOK)
		return RMT_ERROR_WS_HANDSHAKE_STRING_FAIL;
	hash = SHA1_Calculate(buffer, strnlen_s(buffer, buffer_len));
	Base64_Encode(hash.data, sizeof(hash.data), (rmtU8*)buffer);

	// Send the response back to the server with a longer timeout than usual
	response_buffer[0] = 0;
	if (strncat_s(response_buffer, response_buffer_len, websocket_response, sizeof(websocket_response)) != EOK)
		return RMT_ERROR_WS_HANDSHAKE_STRING_FAIL;
	if (strncat_s(response_buffer, response_buffer_len, buffer, buffer_len) != EOK)
		return RMT_ERROR_WS_HANDSHAKE_STRING_FAIL;
	if (strncat_s(response_buffer, response_buffer_len, "\r\n\r\n", 4) != EOK)
		return RMT_ERROR_WS_HANDSHAKE_STRING_FAIL;

	switch (TCPSocket_Send(tcp_socket, response_buffer, strnlen_s(response_buffer, response_buffer_len), 1000))
	{
		case SEND_SUCCESS:
			return RMT_ERROR_NONE;
		case SEND_TIMEOUT:
			return RMT_ERROR_WS_HANDSHAKE_SEND_TIMEOUT;
		case SEND_ERROR:
			return RMT_ERROR_WS_HANDSHAKE_SEND_FAILED;
	}

	return RMT_ERROR_NONE;
}



/*
------------------------------------------------------------------------------------------------------------------------
------------------------------------------------------------------------------------------------------------------------
   Remotery
------------------------------------------------------------------------------------------------------------------------
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