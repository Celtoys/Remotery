
class int2
{
    x: number;
    y: number;

    static readonly Zero = new int2(0, 0);
    static readonly One = new int2(1, 1);

    constructor(x: number = 0, y: number = x)
    {
        this.x = x;
        this.y = y;
    }

    Copy() : int2
    {
        return new int2(this.x, this.y);
    }

    static Add(a: int2, b: int2) : int2
    {
        return new int2(
            a.x + b.x,
            a.y + b.y);
    }

    static Sub(a: int2, b: int2) : int2
    {
        return new int2(
            a.x - b.x,
            a.y - b.y);
    }

    static Mul(a: int2, b: int2) : int2
    {
        return new int2(
            a.x * b.x,
            a.y * b.y);
    }

    static Min(a: int2, b: int2) : int2
    {
        return new int2(
            Math.min(a.x, b.x),
            Math.min(a.y, b.y));
    }

    static Max(a: int2, b: int2) : int2
    {
        return new int2(
            Math.max(a.x, b.x),
            Math.max(a.y, b.y));
    }

    static Min0(a: int2) : int2
    {
        return new int2(
            Math.min(a.x, 0),
            Math.min(a.y, 0));
    }

    static Max0(a: int2) : int2
    {
        return new int2(
            Math.max(a.x, 0),
            Math.max(a.y, 0));
    }

    static Neg(a: int2) : int2
    {
        return new int2(
            -a.x,
            -a.y);
    }

    static Abs(a: int2) : int2
    {
        return new int2(
            Math.abs(a.x),
            Math.abs(a.y));
    }

    static Equal(a: int2, b: int2) : boolean
    {
        if (a == null || b == null)
            return false;
        return a.x == b.x && a.y == b.y;
    }
}

