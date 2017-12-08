
namespace WM
{
    export class Container extends Control
    {
        static TemplateHTML = "<div class='Container'></div>";

        static SnapBorderSize = 5;

        // List of controls contained by the window, in z-order
        Controls: Control[] = [];

        // Connectivity graph for all controls in the container, allowing auto-anchor
        ControlGraph: ControlGraph = new ControlGraph();

        // Sizing simulation for controls on each axis
        protected ControlSizerX: ControlSizer = new ControlSizer();
        protected ControlSizerY: ControlSizer = new ControlSizer();

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

        Remove(control: Control)
        {
            control.Hide();

            let index = this.Controls.indexOf(control);
            this.Controls.splice(index, 1);

            control.ParentContainer = null;
        }

        private UpdateZIndices()
        {
            // ZINDEX needs to be relative to parent!

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

        SetTopControl(control: Control) : void
        {
            // Push the control to the end of the control list
            let index = this.Controls.indexOf(control);
            if (index != -1)
            {
                this.Controls.splice(index, 1);
                this.Controls.push(control);

                // Recalculate z-indices for visible sort
                this.UpdateZIndices();
            }
        }

        SetBottomControl(control: Control) : void
        {
            // Push the control to the start of the control list
            let index = this.Controls.indexOf(control);
            if (index != -1)
            {
                this.Controls.splice(index, 1);
                this.Controls.unshift(control);

                // Recalculate z-indices for visible sort
                this.UpdateZIndices();
            }
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
        }
    }
}
