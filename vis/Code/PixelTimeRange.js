
class PixelTimeRange
{
	constructor(start_us, span_us, span_px)
	{
		this.Span_px = span_px;
		this.Set(start_us, span_us);
	}

	Set(start_us, span_us)
	{
		this.Start_us = start_us;
		this.Span_us = span_us;
		this.End_us = this.Start_us + span_us;
		this.usPerPixel = this.Span_px / this.Span_us;
	}

	SetStart(start_us)
	{
		this.Start_us = start_us;
		this.End_us = start_us + this.Span_us;
	}

	SetEnd(end_us)
	{
		this.End_us = end_us;
		this.Start_us = end_us - this.Span_us;
	}

	SetPixelSpan(span_px)
	{
		this.Span_px = span_px;
		this.usPerPixel = this.Span_px / this.Span_us;
	}

	PixelOffset(time_us)
	{
		return Math.floor((time_us - this.Start_us) * this.usPerPixel);
	}

	PixelSize(time_us)
	{
		return Math.floor(time_us * this.usPerPixel);
	}

	TimeAtPosition(position)
	{
		return this.Start_us + position / this.usPerPixel;
	}

	Clone()
	{
		return new PixelTimeRange(this.Start_us, this.Span_us, this.Span_px);
	}

	SetAsUniform(gl, program)
	{
	    //Uniforms that aren't used by the shaders are commented out.
        //This is because depending on the shader compiler unused uniforms might get optimized away, even if they are declared.
        //When this happens there will be an error thrown as WebGL can't find the uniform.
		//glSetUniform(gl, program, "inTimeRange.pxSpan", this.Span_px);
		glSetUniform(gl, program, "inTimeRange.usStart", this.Start_us);
		//glSetUniform(gl, program, "inTimeRange.usSpan", this.Span_us);
		//glSetUniform(gl, program, "inTimeRange.usEnd", this.End_us);
		glSetUniform(gl, program, "inTimeRange.usPerPixel", this.usPerPixel);
	}
}
