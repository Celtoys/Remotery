#include <stdlib.h>
#include <math.h>
#include <signal.h>
#include <stdio.h>
#include "../lib/Remotery.h"

void aggregateFunction() {
    rmt_BeginCPUSample(aggregate, RMTSF_Aggregate);    
    rmt_EndCPUSample();
}
void recursiveFunction(int depth) {
    rmt_BeginCPUSample(recursive, RMTSF_Recursive);
    if (depth < 5) {
        recursiveFunction(depth + 1);
    }
    rmt_EndCPUSample();
}

double delay() {
    int i, end;
    double j = 0;

    rmt_BeginCPUSample(delay, 0);
    for( i = 0, end = rand()/100; i < end; ++i ) {
        j += sin(i);
    }
    recursiveFunction(0);
    aggregateFunction();
    aggregateFunction();
    aggregateFunction();
    rmt_EndCPUSample();
    return j;
}

int sig = 0;

/// Allow to close cleanly with ctrl + c
void sigintHandler(int sig_num) {
    sig = sig_num;
    printf("Interrupted\n");
}

int main( ) {
    Remotery *rmt;
	rmtError error;

    signal(SIGINT, sigintHandler);

	error = rmt_CreateGlobalInstance(&rmt);
    if( RMT_ERROR_NONE != error) {
		printf("Error launching Remotery %d\n", error);
        return -1;
    }

    while (sig == 0) {
        rmt_LogText("start profiling");
        delay();
        rmt_LogText("end profiling");
    }

    rmt_DestroyGlobalInstance(rmt);
    printf("Cleaned up and quit\n");
    return 0;
}
