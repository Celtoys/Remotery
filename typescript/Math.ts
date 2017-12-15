
// Internal operations of int2 can assume inputs are already integer and avoid rounding
enum int2Round
{
    Do,
    Dont
}


class int2
{
    x: number;
    y: number;

    static readonly Zero = new int2(0, 0);
    static readonly One = new int2(1, 1);

    constructor(x: number = 0, y: number = x, round: int2Round = int2Round.Do)
    {
        if (round == int2Round.Do)
        {
            this.x = Math.round(x);
            this.y = Math.round(y);
        }
        else
        {
            this.x = x;
            this.y = y;
        }
    }

    Copy() : int2
    {
        return new int2(this.x, this.y, int2Round.Dont);
    }

    static Add(a: int2, b: int2) : int2
    {
        return new int2(a.x + b.x, a.y + b.y, int2Round.Dont);
    }

    static Sub(a: int2, b: int2) : int2
    {
        return new int2(a.x - b.x, a.y - b.y, int2Round.Dont);
    }

    static Mul(a: int2, b: int2) : int2
    {
        return new int2(a.x * b.x, a.y * b.y, int2Round.Dont);
    }

    static Min(a: int2, b: int2) : int2
    {
        return new int2(Math.min(a.x, b.x), Math.min(a.y, b.y), int2Round.Dont);
    }

    static Max(a: int2, b: int2) : int2
    {
        return new int2(Math.max(a.x, b.x), Math.max(a.y, b.y), int2Round.Dont);
    }

    static Min0(a: int2) : int2
    {
        return new int2(Math.min(a.x, 0), Math.min(a.y, 0), int2Round.Dont);
    }

    static Max0(a: int2) : int2
    {
        return new int2(Math.max(a.x, 0), Math.max(a.y, 0), int2Round.Dont);
    }

    static Neg(a: int2) : int2
    {
        return new int2(-a.x, -a.y, int2Round.Dont);
    }

    static Abs(a: int2) : int2
    {
        return new int2(Math.abs(a.x), Math.abs(a.y), int2Round.Dont);
    }

    static Equal(a: int2, b: int2) : boolean
    {
        if (a == null || b == null)
            return false;
        return a.x == b.x && a.y == b.y;
    }
}


class AABB
{
    min: int2;
    max: int2;

    constructor(min: int2, max: int2)
    {
        this.min = min;
        this.max = max;
    }

    Expand(e: number) : void
    {
        let ev = new int2(e);
        this.min = int2.Sub(this.min, ev);
        this.max = int2.Add(this.max, ev);
    }

    static Intersect(a: AABB, b: AABB) : boolean
    {
        return a.min.x < b.max.x && a.min.y < b.max.y && b.min.x < a.max.x && b.min.y < a.max.y;
    }
}
