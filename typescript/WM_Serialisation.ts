
// TODO: Hidden state, z-index, just overwrites existing data, doesn't save new layouts

namespace WM
{
    class SavedControl
    {
        ID: number;
        Position: int2;
        Size: int2;
        ZIndex: number;
    }

    class SavedContainer extends SavedControl
    {
        Controls: SavedContainer[] = [ ];
    }

    class SavedWindow extends SavedContainer
    {
        Title: string;
    }

    function BuildSavedContainerList(container: Container, saved_container: SavedContainer)
    {
        for (let control of container.Controls)
        {
            if (control instanceof Window)
                saved_container.Controls.push(BuildSavedWindow(control as Window));
            else if (control instanceof Container)
                saved_container.Controls.push(BuildSavedContainer(control as Container));
        }
    }

    function BuildSavedControl(control: Control, saved_control: SavedControl) : void
    {
        saved_control.ID = control.ID;
        saved_control.Position = control.Position;
        saved_control.Size = control.Size;
        saved_control.ZIndex = control.ZIndex;
    }

    function BuildSavedContainer(container: Container) : SavedContainer
    {
        let saved_container = new SavedContainer();
        BuildSavedControl(container, saved_container);
        BuildSavedContainerList(container, saved_container);
        return saved_container;
    }

    function BuildSavedWindow(window: Window) : SavedWindow
    {
        let saved_window = new SavedWindow();
        BuildSavedControl(window, saved_window);
        saved_window.Title = window.Title;
        BuildSavedContainerList(window, saved_window);
        return saved_window;
    }

    export function SaveContainer(container: Container) : string
    {
        let saved_container = BuildSavedContainer(container);
        return JSON.stringify(saved_container);
    }

    function ApplyContainerList(container: Container, saved_container: SavedContainer)
    {
        if (saved_container.Controls === undefined)
            return;

        for (let i = 0; i < saved_container.Controls.length; i++)
        {
            let child_saved_control = saved_container.Controls[i];

            // Search for control with matching ID
            for (let j = 0; j < container.Controls.length; j++)
            {
                let child_control = container.Controls[j];
                if (child_control.ID == child_saved_control.ID)
                {
                    if (child_control instanceof Window)
                        ApplyWindow(child_control as Window, <SavedWindow>child_saved_control);
                    else if (child_control instanceof Container)
                        ApplyContainer(child_control as Container, <SavedContainer>child_saved_control);
                    
                    break;
                }
            }
        }
    }

    function ApplyControl(control: Control, saved_control: SavedControl)
    {
        if (saved_control.Position !== undefined)
            control.Position = new int2(saved_control.Position.x, saved_control.Position.y);
        
        if (saved_control.Size !== undefined)
            control.Size = new int2(saved_control.Size.x, saved_control.Size.y);

        if (saved_control.ZIndex !== undefined && saved_control.ZIndex != null)
            control.ZIndex = saved_control.ZIndex;
    }

    function ApplyWindow(window: Window, saved_window: SavedWindow)
    {
        ApplyControl(window, saved_window);

        if (saved_window.Title !== undefined)
            window.Title = <string>saved_window.Title;

        ApplyContainerList(window, saved_window);
    }

    function ApplyContainer(container: Container, saved_container: SavedContainer)
    {
        ApplyControl(container, saved_container);
        ApplyContainerList(container, saved_container);
    }

    export function LoadContainer(container: Container, input: string)
    {
        let saved_container = JSON.parse(input);
        ApplyContainer(container, saved_container);
    }
}