#include <stdlib.h>
#include <math.h>
#include <signal.h>
#include <stdio.h>
#include <string.h>
#include "../lib/Remotery.h"

#include <assert.h>

rmt_PropertyDefine_Group(Game, "Game Properties");
rmt_PropertyDefine_Bool(WasUpdated, RMT_FALSE, FrameReset, "Was the game loop executed this frame?", &Game);
rmt_PropertyDefine_U32(RecursiveDepth, 0, FrameReset, "How deep did we go in recursiveFunction?", &Game);
rmt_PropertyDefine_F32(Accumulated, 0, FrameReset, "What was the latest value?", &Game);
rmt_PropertyDefine_U32(FrameCounter, 0, NoFlags, "What is the current frame number?", &Game);


void aggregateFunction() {
    rmt_BeginCPUSample(aggregate, RMTSF_Aggregate);    
    rmt_EndCPUSample();
}
void recursiveFunction(int depth) {
    rmt_PropertySet_U32(RecursiveDepth, depth);
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
        double v = sin(i);
        j += v;

        rmt_PropertyAdd_F32(Accumulated, v);
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
    if (strcmp("Remotery", thread_name) == 0)
    {
        return; // to minimize the verbosity in this example
    }

    printf("// ********************   DUMP TREE: %s   ************************\n", thread_name);

    printTree(root, 0);
}

void printProperty(rmtProperty* property, int indent)
{
    rmtPropertyIterator iter;

    const char* name = rmt_PropertyGetName(property);
    rmtPropertyType type = rmt_PropertyGetType(property);
    rmtPropertyValue value = rmt_PropertyGetValue(property);

    printIndent(indent); printf("%s: ", name);

    switch(type)
    {
    case RMT_PropertyType_rmtBool: printf("%s\n", value.Bool ? "true":"false"); break;
    case RMT_PropertyType_rmtS32: printf("%d\n", value.S32); break;
    case RMT_PropertyType_rmtU32: printf("%u\n", value.U32); break;
    case RMT_PropertyType_rmtF32: printf("%f\n", value.F32); break;
    case RMT_PropertyType_rmtS64: printf("%lld\n", value.S64); break;
    case RMT_PropertyType_rmtU64: printf("%llu\n", value.U64); break;
    case RMT_PropertyType_rmtF64: printf("%g\n", value.F64); break;
    case RMT_PropertyType_rmtGroup: printf("\n"); break;
    default: break;
    };

    rmt_PropertyIterateChildren(&iter, property);
    while (rmt_PropertyIterateNext(&iter)) {
        printProperty(iter.property, indent + 1);
    }
}

void dumpProperties(void* ctx, rmtProperty* root)
{
    rmtPropertyIterator iter;
    printf("// ********************   DUMP PROPERTIES:      ************************\n");

    rmt_PropertyIterateChildren(&iter, root);
    while (rmt_PropertyIterateNext(&iter)) {
        printProperty(iter.property, 0);
    }
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

        settings->snapshot_callback = dumpProperties;
        settings->snapshot_context = 0;
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

        rmt_PropertySet_Bool(WasUpdated, RMT_TRUE);
        rmt_PropertyAdd_U32(FrameCounter, 1);

        rmt_PropertySnapshotAll();
        rmt_PropertyFrameResetAll();
    }

    rmt_DestroyGlobalInstance(rmt);
    printf("Cleaned up and quit\n");
    return 0;
}
