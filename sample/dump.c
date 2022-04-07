#include <stdlib.h>
#include <math.h>
#include <signal.h>
#include <stdio.h>
#include "../lib/Remotery.h"

#include <assert.h>


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

void printIndent(int indent)
{
    int i;
    for (i = 0; i < indent; ++i) {
        printf("  ");
    }
}

void printSample(rmtSample* sample, int indent)
{
    const char* name = rmt_SampleGetName(sample);
    rmtU32 callcount = rmt_SampleGetCallCount(sample);
    rmtU64 time = rmt_SampleGetTime(sample);
    rmtU64 self_time = rmt_SampleGetSelfTime(sample);
    rmtSampleType type = rmt_SampleGetType(sample);
    rmtU8 r, g, b;
    rmt_SampleGetColour(sample, &r, &g, &b);

    printIndent(indent); printf("%s %u  time: %llu  self: %llu type: %d  color: 0x%02x%02x%02x\n", name, callcount, time, self_time, type, r, g, b);
}

void printTree(rmtSample* sample, int indent)
{
    rmtSampleIterator iter;

    printSample(sample, indent);

    rmt_IterateChildren(&iter, sample);
    while (rmt_IterateNext(&iter)) {
        printTree(iter.sample, indent+1);
    }
}

void dumpTree(void* ctx, rmtSampleTree* sample_tree)
{
    rmtSample* root = rmt_SampleTreeGetRootSample(sample_tree);
    const char* thread_name = rmt_SampleTreeGetThreadName(sample_tree);

    printf("// ********************   DUMP TREE: %s   ************************\n", thread_name);

    printTree(root, 0);
}

int sig = 0;

/// Allow to close cleanly with ctrl + c
void sigintHandler(int sig_num) {
    sig = sig_num;
    printf("Interrupted\n");
}

int main() {
    Remotery* rmt;
	rmtError error;

    signal(SIGINT, sigintHandler);

    rmtSettings* settings = rmt_Settings();
    if (settings)
    {
        settings->sampletree_handler = dumpTree;
        settings->sampletree_context = 0;
    }

	error = rmt_CreateGlobalInstance(&rmt);

    if( RMT_ERROR_NONE != error) {
		printf("Error launching Remotery %d\n", error);
        return -1;
    }

    int max_count = 5;

    while (sig == 0 && --max_count > 0) {
        rmt_LogText("start profiling");
        delay();
        rmt_LogText("end profiling");
    }

    rmt_DestroyGlobalInstance(rmt);
    printf("Cleaned up and quit\n");
    return 0;
}
