
namespace WM
{
    export enum RulerOrient
    {
        Vertical,
        Horizontal
    }

    export class Ruler extends Control
    {
        static TemplateHTML = "<div class='Ruler'></div>";
        
        constructor(position: number, orient: RulerOrient)
        {
            let position_2d = orient == RulerOrient.Vertical ? new int2(position, 0) : new int2(0, position);
            let size_2d = orient == RulerOrient.Vertical ? new int2(0, 1000) : new int2(1000, 0);
            super(new DOM.Node(Ruler.TemplateHTML), position_2d, size_2d);
        }
    }
}