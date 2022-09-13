#include <assert.h>
#include <math.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "../lib/Remotery.h"

typedef void (*ThreadFunction)(void*);

#if defined(_MSC_VER)

// TODO: add a windows thread version

#include <Windows.h>
typedef HANDLE thread_t;

static thread_t thread_create(ThreadFunction thread_start, const char* name, void* context)
{
    (void)name;
    DWORD thread_id;
    DWORD stack_size = 100000;
    HANDLE thread = CreateThread(NULL, stack_size,
                                 (LPTHREAD_START_ROUTINE) thread_start,
                                 context, 0, &thread_id);
    return thread;
}


static void thread_join(thread_t thread)
{
    DWORD ret = WaitForSingleObject(thread, INFINITE);
    assert(ret == WAIT_OBJECT_0);
}


#else

#include <pthread.h>
#include <limits.h>
#include <unistd.h>

typedef pthread_t thread_t;

typedef struct _thread_data_t
{
    ThreadFunction  function;
    const char*     name;
    void*           context;
} thread_data_t;

static void thread_start_proxy(void* arg)
{
    thread_data_t* data = (thread_data_t*) arg;
    rmt_SetCurrentThreadName(data->name);

    data->function(data->context);
    free((void*)data->name);
    free(data);
}

thread_t thread_create(ThreadFunction thread_start, const char* name, void* context)
{
    pthread_attr_t attr;
    int ret = pthread_attr_init(&attr);
    assert(ret == 0);

    long page_size = sysconf(_SC_PAGESIZE);
    if (page_size == -1)
        page_size = 4096;

    long stack_size = 0;
    if (PTHREAD_STACK_MIN > stack_size)
        stack_size = PTHREAD_STACK_MIN;

    // NOTE: At least on OSX the stack-size must be a multiple of page size
    stack_size /= page_size;
    stack_size += 1;
    stack_size *= page_size;

    ret = pthread_attr_setstacksize(&attr, stack_size);
    assert(ret == 0);

    pthread_t thread;

    thread_data_t* thread_data = (thread_data_t*)malloc(sizeof(thread_data_t));
    thread_data->function = thread_start;
    thread_data->name = strdup(name);
    thread_data->context = context;

    ret = pthread_create(&thread, &attr, (void* (*)(void*)) thread_start_proxy, thread_data);
    assert(ret == 0);
    ret = pthread_attr_destroy(&attr);
    assert(ret == 0);

    return thread;
}

static void thread_join(thread_t thread)
{
    int ret = pthread_join(thread, 0);
    assert(ret == 0);
}

#endif
// End threads
// **************************************************************

static int sig = 0;

/// Allow to close cleanly with ctrl + c
void sigintHandler(int sig_num) {
    sig = sig_num;
    printf("Interrupted\n");
}

static void aggregateFunction() {
    rmt_BeginCPUSample(aggregate, RMTSF_Aggregate);
    rmt_EndCPUSample();
}

static void recursiveFunction(int depth) {
    rmt_BeginCPUSample(recursive, RMTSF_Recursive);
    if (depth < 5) {
        recursiveFunction(depth + 1);
    }
    rmt_EndCPUSample();
}

static void Run(void* context)
{
    printf("Entering thread!\n");
    int counter = *(int*)context;
    while (sig == 0 && counter-- > 0)
    {
        rmt_BeginCPUSample(Run, 0);
            aggregateFunction();
            recursiveFunction(0);
        rmt_EndCPUSample();
    }

    printf("Exited thread\n");
}


int main(int argc, char** argv)
{
    Remotery *rmt;
    rmtError error;

    int i;
    int num_threads = 4;
    thread_t threads[4];

    signal(SIGINT, sigintHandler);

    printf("Creating remotery instance\n");
    error = rmt_CreateGlobalInstance(&rmt);
    if( RMT_ERROR_NONE != error) {
        printf("Error launching Remotery %d: %s\n", error, rmt_GetLastErrorMessage());
        return -1;
    }

    int max_count = 0x0FFFFFFF;
    int count = max_count;
    if (argc >= 2)
    {
        count = atoi(argv[1]);

        if (count < 0)
            count = max_count;
    }
    if (count != max_count)
        printf("Looping max %d times per thread.\n", count);

    printf("Spawning %d threads\n", num_threads);
    for (i = 0; i < num_threads; ++i)
    {
        char name[32];
        snprintf(name, sizeof(name), "thread_%d", i);

        threads[i] = thread_create(Run, name, &count);
    }

    printf("Press CTRL+C to exit program\n");

    for (i = 0; i < num_threads; ++i)
    {
        thread_join(threads[i]);
    }

    rmt_DestroyGlobalInstance(rmt);
    printf("Cleaned up and quit\n");
    return 0;
}
