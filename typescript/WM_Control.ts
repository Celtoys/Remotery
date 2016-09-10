
//
// Options:
//    * Anchor to width/height of parent container
//    * Anchor left/right and top/bottom to parent container
//      - Note that with relative movement there is no need to anchor left/right to parent container
//    * Anchor left/right and top/bottom to neighbouring controls
//      - If the objects are numbers then it's interpreted as anchoring to parent container
//      - What happens when a control is removed? Its anchor reference in neighbouring controls needs to be removed?
//      - Without any form of cleanup, closed windows will be kept alive in memory by the GC
//      - When you move or resize a control, it needs to know that it is anchoring neighbouring controls
//        - The slow alternative would be to reanchor all controls in the parent container
//
// Currently I have no need for control-relative anchoring but I can see myself using it if it becomes available.
//
// TODO: Anchor to a control needs an anchor distance
// TODO: Update only neighbouring anchored controls instead of visiting every control in the parent container
//

namespace WM
{
    export class Control
    {
        // Main generated HTML node for the control
        Node: DOM.Node;

        // Parent container for the control; can be null in the case of the browser body
        private _ParentContainer: Container;

        // Rectangle coverage
        // Always ensure position/size are defined as they are required to calculate bottom-right
        private _Position = new int2(0);
        private _Size = new int2(0);
        private _BottomRight = new int2(0);

        // Records current visibility state - not for external writes
        private _Visible: boolean = false;

        // Layout anchor points
        private LeftAnchor: number | Control;
        private RightAnchor: number | Control;
        private TopAnchor: number;
        private BottomAnchor: number;


        // ----- Constructor ---------------------------------------------------------------


        constructor(node: DOM.Node, position: int2, size: int2)
        {
            this.Node = node;
            this.Position = position;
            this.Size = size;

            this.Node.MouseDownEvent.Subscribe(this.OnMouseDown);
        }


        // ----- Public API Properties -----------------------------------------------------


        // Cached node position
        set Position(position: int2)
        {
            this._Position = position;
            this.Node.Position = position;
            this._BottomRight = int2.Add(this._Position, this._Size);
        }
        get Position() : int2
        {
            return this._Position;
        }

        // Cached node size
        // Size set in alternate implementation because you can't access
        //    properties from 'super'
        protected SetSize(size: int2) : void
        {
            this._Size = size;
            this.Node.Size = size;
            this._BottomRight = int2.Add(this._Position, this._Size);
        }
        set Size(size: int2)
        {
            this.SetSize(size);
        }
        get Size() : int2
        {
            return this._Size;
        }

        // Alternative rectangle coverage access
        set TopLeft(tl: int2)
        {
            let old_br = this._BottomRight.Copy();
            this.Position = tl;
            this.Size = int2.Sub(old_br, this.Position);
        }
        get TopLeft() : int2
        {
            return this._Position;
        }
        set BottomRight(br: int2)
        {
            this.SetSize(int2.Sub(br, this._Position));
        }
        get BottomRight() : int2
        {
            return this._BottomRight;
        }

        // Tells whether the control thinks it's visible or not
        get Visible() : boolean
        {
            return this._Visible;
        }


        // ----- Internal API Properties ---------------------------------------------------


        // Sets control z-index
        set ZIndex(z_index: number)
        {
            this.Node.ZIndex = z_index;
        }

        // Set/Get the parent container for this control
        set ParentContainer(parent_container: Container)
        {
            if (this._ParentContainer == null)
                $(document.body).ResizeEvent.Unsubscribe(this.OnParentResize);

            this._ParentContainer = parent_container;

            if (this._ParentContainer == null)
                $(document.body).ResizeEvent.Subscribe(this.OnParentResize);
        }
        get ParentContainer() : Container
        {
            return this._ParentContainer;
        }

        // Returns a node within the parent container that's designated for adding controls
        // Or document.body if there is no parent
        protected get ParentNode() : DOM.Node
        {
            let parent_container = this.ParentContainer;
            if (parent_container == null)
                return $(document.body);
            return parent_container.ControlParentNode;
        }


        // ----- Public API Methods --------------------------------------------------------


        Show() : void
        {
            // Add to parent node if not already there
            if (this.Node.Parent == null)
            {
                this.ParentNode.Append(this.Node);
                this._Visible = true;

                // Trigger resize event to match anchors
                this.OnParentResize();
            }
        }
        Hide() : void
        {
            if (this.Node.Parent != null)
            {
                this.Node.Detach();
                this._Visible = false;
            }
        }

        BringToTop() : void
        {
            if (this._ParentContainer)
                this._ParentContainer.SetTopControl(this);
        }

        // Set anchor and trigger resize event
        AnchorLeftToParent(left: number | Control) : void
        {
            this.LeftAnchor = left;
            this.OnParentResize();
        }
        AnchorRightToParent(right: number | Control) : void
        {
            this.RightAnchor = right;
            this.OnParentResize();
        }
        AnchorTopToParent(left: number) : void
        {
            this.TopAnchor = left;
            this.OnParentResize();
        }
        AnchorBottomToParent(left: number) : void
        {
            this.BottomAnchor = left;
            this.OnParentResize();
        }

        /*AnchorWidthToParent(width: number) : void
        {
            // Set anchor and trigger resize event
            this.WidthAnchor = width;
            this.OnParentResize();
        }
        AnchorHeightToParent(height: number) : void
        {
            // Set anchor and trigger resize event
            this.HeightAnchor = height;
            this.OnParentResize();
        }*/


        // ----- Internal API Methods ------------------------------------------------------


        OnParentResize = () =>
        {
            //let parent_size = this.ParentNode.Size;

            if (this.LeftAnchor != null && this.LeftAnchor instanceof Control)
            {
                let left_anchor = <Control>this.LeftAnchor;
                let left = left_anchor.BottomRight.x;
                this.Position = new int2(left, this.Position.y);
            }
            if (this.RightAnchor != null)
            {
                let left: number;
                if (this.ParentContainer && typeof this.RightAnchor == "number")
                {
                    left = this.ParentContainer.Size.x - <number>this.RightAnchor;
                }
                if (this.RightAnchor instanceof Control)
                {   
                }
                this.BottomRight = new int2(left, this.BottomRight.y);
            }

            // Update anchor points
            /*if (this.WidthAnchor != null)
            {
                let new_size_x = parent_size.x - this.Position.x - this.WidthAnchor;
                this.Size = new int2(new_size_x, this.Size.y);
            }
            if (this.HeightAnchor != null)
            {
                let new_size_y = parent_size.y - this.Position.y - this.HeightAnchor;
                this.Size = new int2(this.Size.x, new_size_y);
            }*/
        }

        private OnMouseDown = (event: MouseEvent) =>
        {
            // Allow bubble-up for this event so that it filters through nested windows
            this.BringToTop();
        }
    }
}