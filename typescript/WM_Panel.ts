
interface Window
{
    WMRootNode: DOM.Node;
    WMRootPanel: WM.Panel;
}

namespace WM
{
    export class Panel
    {
        static SnapBorderSize = 5;

        private static TemplateHTML = "<div class='Panel'>/div>";

        // Main generated HTML node for the control
        // TODO: Can this be made private?
        Node: DOM.Node;

        // PART: Panel container
        Container: PanelContainer;

        // Parent panel that is always set, even when the panel node is hidden and not part of the DOM tree
        private _ParentPanel: Panel;

        // Rectangle coverage
        // Always ensure position/size are defined as they are required to calculate bottom-right
        private _Position = new int2(0);
        private _Size = new int2(0);
        private _BottomRight = new int2(0);

        // Records current visibility state
        private _Visible = false;

        constructor(position: int2, size: int2, node?: DOM.Node)
        {
            // First-time initialisation of any panel resources
            if (window.WMRootNode == null)
            {
                // TODO: Can fully flesh out root panel size and event handlers here
                window.WMRootNode = $(document.body);
                window.WMRootPanel = new Panel(new int2(0), new int2(0), window.WMRootNode);
            }

            this.Node = node ? node : new DOM.Node(Panel.TemplateHTML);

            // Store position/size directly so that bottom/right can be calculated
            this._Position = position;
            this._Size = size;
            this._BottomRight = int2.Add(this._Position, this._Size);

            // Apply initial settings to the node
            this.Node.Position = this._Position;
            this.Node.Size = this._Size;
            
            // Parent everything to the root to start with
            window.WMRootPanel.Container.Add(this);

            this.Node.MouseDownEvent.Subscribe(this.OnMouseDown);
        }

        // Cached node position
        set Position(position: int2)
        {
            this._Position = position;
            this._BottomRight = int2.Add(this._Position, this._Size);
            this.Node.Position = position;
        }
        get Position() : int2
        {
            return this._Position;
        }

        // Cached node size
        set Size(size: int2)
        {
            this._Size = size;
            this._BottomRight = int2.Add(this._Position, this._Size);
            this.Node.Size = size;
        }
        get Size() : int2
        {
            return this._Size;
        }

        // Alternative rectangle coverage
        set TopLeft(tl: int2)
        {
            this._Position = tl;
            this._Size = int2.Sub(this._BottomRight, tl);
            this.Node.Position = tl;
            this.Node.Size = this._Size;
        }
        get TopLeft() : int2
        {
            return this.Position;
        }
        set BottomRight(br: int2)
        {
            this.Size = int2.Sub(br, this._Position);
        }
        get BottomRight() : int2
        {
            return this._BottomRight;
        }

        // Tells whether the panel thinks it's visible or not
        get Visible() : boolean
        {
            return this._Visible;
        }

        // Panel this one is contained by
        set ParentPanel(parent_panel : Panel)
        {
            this._ParentPanel = parent_panel;
        }
        get ParentPanel() : Panel
        {
            return this._ParentPanel;
        }

        // Returns the node which all added panels are parented to
        get PanelContainerNode() : DOM.Node
        {
            return this.Node;
        }

        // Make the panel visible
        Show()
        {
            // Node will be parented to a panel but might not yet be part of the element tree
            if (this.Node.ParentElement == null)
                this.ParentPanel.Node.Append(this.Node);
            
            this._Visible = true;
        }

        // Hide the panel
        Hide()
        {
            // Safe to detach a node with no parent; saves a branch here
            this.Node.Detach();
            this._Visible = false;
        }

        SendToTop()
        {
            let parent_panel_container = this.ParentPanel.Container;
            let parent_panels = parent_panel_container.Panels;
            
            // Push to the back of the parent's panel list
            let index = parent_panels.indexOf(this);
            if (index != -1)
            {
                parent_panels.splice(index, 1);
                parent_panels.push(this);

                // Recalculate z-indices for visible sort
                parent_panel_container.UpdateZIndices();
            }
        }

        SendToBottom()
        {
            let parent_panel_container = this.ParentPanel.Container;
            let parent_panels = parent_panel_container.Panels;

            // Push to the front of the parent's panel list 
            let index = parent_panels.indexOf(this);
            if (index != -1)
            {
                parent_panels.splice(index, 1);
                parent_panels.unshift(this);

                // Recalculate z-indices for visible sort
                parent_panel_container.UpdateZIndices();
            }
        }

        private OnMouseDown = (event: MouseEvent) =>
        {
            // Allow bubble-up for this event so that it filters through nested windows
            this.SendToTop();
        }
    }
}
