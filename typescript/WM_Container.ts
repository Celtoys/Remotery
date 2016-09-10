
namespace WM
{
    export class Container extends Control
    {
        static TemplateHTML = "<div class='Container'></div>";

        // List of controls contained by the window, in z-order
        protected Controls: Control[] = [];

        constructor(position: int2, size: int2, node?: DOM.Node)
        {
            super(node ? node : new DOM.Node(Container.TemplateHTML), position, size);
        }

        Add(control: Control) : Control
        {
            this.Controls.push(control);
            control.ParentContainer = this;
            control.Show();
            return control;
        }

        SetTopControl(control: Control) : void
        {
            // ZINDEX needs to be relative to parent!
            
            // Bring the control to the top of the control List
            let top_index = this.Controls.indexOf(control);
            if (top_index != -1)
            {
                this.Controls.splice(top_index, 1);
                this.Controls.push(control);

                // Set a CSS z-index for each visible control from the bottom-up
                for (let i = 0; i < this.Controls.length; i++)
                {
                    let control = this.Controls[i];
                    if (!control.Visible)
                        continue;

			        // Ensure there's space between each window for the elements inside to be sorted
			        let z = (i + 1) * 10;
                    control.ZIndex = z;
                }
            }
        }


        GetSnapEdge(pos: int2, mask: int2, excluding: Control) : int2
        {
            // Snap border size
            let b = 5;

            // Selects between control edge and a border-distance outside the control edge
            let p_mask = int2.Mul(int2.Max0(mask), new int2(b - 1));
            let n_mask = int2.Mul(int2.Min0(mask), new int2(-b + 1));

            // Start off with no snap adjustment
            let snap_pos = pos.Copy();

            let snapped = false;
            for (let control of this.Controls)
            {
                if (control == excluding)
                    continue;

                // Distance from input position to opposing corners of the control
                let d_tl = int2.Abs(int2.Sub(pos, control.TopLeft));
                let d_br = int2.Abs(int2.Sub(pos, control.BottomRight));

                if (mask.x != 0)
                {
                    if (d_tl.x < b)
                    {
                        snap_pos.x = control.TopLeft.x - p_mask.x;
                        snapped = true;
                    }                    
                    if (d_br.x < b)
                    {
                        snap_pos.x = control.BottomRight.x + n_mask.x;
                        snapped = true;
                    }
                }

                if (mask.y != 0)
                {
                    if (d_tl.y < b)
                    {
                        snap_pos.y = control.TopLeft.y - p_mask.y;
                        snapped = true;
                    }                    
                    if (d_br.y < b)
                    {
                        snap_pos.y = control.BottomRight.y + n_mask.y;
                        snapped = true;
                    }
                }
            }

            return snapped ? snap_pos : null;
        }

        // Returns the node which all controls added to the container are parented to
        get ControlParentNode() : DOM.Node
        {
            return this.Node;
        }

        protected SetSize(size: int2) : void
        {
            // Set size on super and notify child controls
            super.SetSize(size);
            this.UpdateControlSizes();
        }

        public UpdateControlSizes()
        {
            // This gets called from the super call in the constructor!
            // ...which is to be expected from the overridden Size property.
            if (this.Controls)
            {
                for (let control of this.Controls)
                    control.OnParentResize();
            }
        }
    }
}
