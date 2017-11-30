
namespace WM
{
    function GenerateID(position: int2, size: int2) : number
    {
        // Use initial placement of the container as a unique ID generator
        let a = Hash.Combine_U32(Hash.Wang_U32(position.x), Hash.Wang_U32(position.y));
        let b = Hash.Combine_U32(Hash.Wang_U32(size.x), Hash.Wang_U32(size.y));
        return Hash.Combine_U32(a, b);
    }


    export class Control
    {
        // Unique ID within a container's control list
        ID: number;

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


        // ----- Constructor ---------------------------------------------------------------


        constructor(node: DOM.Node, position: int2, size: int2)
        {
            this.ID = GenerateID(position, size);
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


        // Set/Get control z-index
        set ZIndex(z_index: number)
        {
            this.Node.ZIndex = z_index;
        }
        get ZIndex() : number
        {
            return this.Node.ZIndex;
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

        SendToTop() : void
        {
            if (this._ParentContainer)
                this._ParentContainer.SetTopControl(this);
        }

        SendToBottom() : void
        {
            if (this._ParentContainer)
                this._ParentContainer.SetBottomControl(this);
        }


        // ----- Internal API Methods ------------------------------------------------------


        OnParentResize = () =>
        {
            // TODO: Snap on show?
        }

        private OnMouseDown = (event: MouseEvent) =>
        {
            // Allow bubble-up for this event so that it filters through nested windows
            this.SendToTop();
        }
    }
}