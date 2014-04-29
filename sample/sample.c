#include <stdlib.h>
#include <math.h>
#include "Remotery.h"

void delay() {
    int i, end;

    rmt_BeginCPUSample(delay);
    for( i = 0, end = rand(); i < end; ++i ) {
        double j = sin(i);
    }
    rmt_EndCPUSample();
}


int main( int argc, const char **argv ) {
    Remotery *rmt;

    if( RMT_ERROR_NONE != rmt_CreateGlobalInstance(&rmt) ) {
        return -1;
    }

    for(;;) {
        rmt_LogText("start profiling");
        delay();
        rmt_LogText("end profiling");
    }

    rmt_DestroyGlobalInstance(rmt);
    return 0;
}
