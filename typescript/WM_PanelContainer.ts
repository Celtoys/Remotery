namespace WM
{
    export class PanelContainer
    {
        // Panel that owns this part
        Owner: Panel;

        // List of contained panels in z-order
        Panels: Panel[] = [];
        
        constructor(owner: Panel)
        {
            this.Owner = owner;
        }

        // Add as a child and show
        Add(panel: Panel) : Panel
        {
            // Remove from any existing parent
            // Panels always have a parent and so it can be assumed the parent has a panel container
            panel.ParentPanel.Container.Remove(panel);

            // Parent this panel
            this.Panels.push(panel);
            panel.ParentPanel = this.Owner;

            panel.Show();

            return panel;
        }

        // Hide and remove from this panel
        Remove(panel: Panel)
        {
            panel.Hide();

            // Remove from the panel list and orphan
            let index = this.Panels.indexOf(panel);
            this.Panels.splice(index);
            panel.ParentPanel = window.WMRootPanel;
        }

        UpdateZIndices()
        {
            // TODO: ZINDEX needs to be relative to parent!

            // Set a CSS z-index for each visible panel from the bottom up
            for (let i = 0; i < this.Panels.length; i++)
            {
                let panel = this.Panels[i];
                if (!panel.Visible)
                    continue;

                // Ensure there's space between each window for the elements inside to be sorted
                // TODO: Update with full knowledge of child panels
                let z = (i + 1) * 10;
                panel.Node.ZIndex = z;
            }
        }
    };
}