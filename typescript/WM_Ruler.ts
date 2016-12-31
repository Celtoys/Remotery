
namespace WM
{
    export const enum RulerOrient
    {
        Horizontal,
        Vertical,
    }

    export class Ruler extends Control
    {
        static TemplateHTML = "<div class='Ruler'></div>";

        // Big enough to span entire screen while being clipped by parent
        static Size = 10000;

        // Current orientation
        private _Orient: RulerOrient;
        
        private static Position2D(orient: RulerOrient, position: number) : int2
        {
            return orient == RulerOrient.Horizontal ?
                new int2(0, position) :
                new int2(position, 0);
        }

        private static Size2D(orient: RulerOrient) : int2
        {
            return orient == RulerOrient.Horizontal ?
                new int2(Ruler.Size, 0) :
                new int2(0, Ruler.Size);
        }

        constructor(orient: RulerOrient, position: number)
        {
            super(new DOM.Node(Ruler.TemplateHTML),
                Ruler.Position2D(orient, position),
                Ruler.Size2D(orient));

            this._Orient = orient;
        }

        SetPosition(position: number) : void
        {
            this.Position = Ruler.Position2D(this._Orient, position);
        }
    }
}