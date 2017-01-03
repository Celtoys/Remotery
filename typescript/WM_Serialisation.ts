
// TODO: Hidden state, z-index, just overwrites existing data, doesn't save new layouts

namespace WM
{
    class SavedControl
    {
        Position: int2;
        Size: int2;
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

    function BuildSavedContainer(container: Container) : SavedContainer
    {
        let saved_container = new SavedContainer();
        saved_container.Position = container.Position;
        saved_container.Size = container.Size;
        BuildSavedContainerList(container, saved_container);
        return saved_container;
    }

    function BuildSavedWindow(window: Window) : SavedWindow
    {
        let saved_window = new SavedWindow();
        saved_window.Position = window.Position;
        saved_window.Size = window.Size;
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
        for (let i = 0; i < saved_container.Controls.length; i++)
        {
            if (i == container.Controls.length)
                break;

            let child_control = container.Controls[i];
            let child_saved_control = saved_container.Controls[i];

            if (child_control instanceof Window)
                ApplyWindow(child_control as Window, <SavedWindow>child_saved_control);
            else if (child_control instanceof Container)
                ApplyContainer(child_control as Container, <SavedContainer>child_saved_control);
        }
    }

    function ApplyWindow(window: Window, saved_window: SavedWindow)
    {
        window.Position = saved_window.Position;
        window.Size = saved_window.Size;
        window.Title = saved_window.Title;
        ApplyContainerList(window, saved_window);
    }

    function ApplyContainer(container: Container, saved_container: SavedContainer)
    {
        container.Position = saved_container.Position;
        container.Size = saved_container.Size;
        ApplyContainerList(container, saved_container);
    }

    export function LoadContainer(container: Container, input: string)
    {
        let saved_container = JSON.parse(input);
        ApplyContainer(container, saved_container);
    }
}