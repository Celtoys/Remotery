
class DOMEvent
{
    // Trigger for the DOM event
    Trigger: HTMLElement | Window;

    // Event name
    EventName: string;

    constructor(trigger: HTMLElement | Window, event_name: string)
    {
        this.Trigger = trigger;
        this.EventName = event_name;
    }

    Subscribe(listener: EventListener) : void
    {
        this.Trigger.addEventListener(this.EventName, listener, false);
    }

    Unsubscribe(listener: EventListener) : void
    {
        this.Trigger.removeEventListener(this.EventName, listener, false);
    }
}


namespace DOM
{
    export namespace Event
    {
        // Retrieves the event from the first parameter passed into an HTML event
        export function Get(event: MouseEvent) : MouseEvent
        {
	        // Internet explorer doesn't pass the event
            return <MouseEvent>window.event || event;
        }

        // Stops events bubbling up to parent event handlers
        export function StopPropagation(event: Event)
        {
            if (event)
            {
                event.cancelBubble = true;
                if (event.stopPropagation)
                    event.stopPropagation();
            }
        }

        // Stop default action for event
        export function StopDefaultAction(event: Event)
        {
            if (event && event.preventDefault)
                event.preventDefault();
            else if (window.event && window.event.returnValue)
                window.event.returnValue = false;
        }

        // Get the position of the mouse cursor, page relative
        export function GetMousePosition(event: MouseEvent) : int2
        {
            let e = Get(event);
            let p = new int2();
            if (e.pageX || e.pageY)
            {
                p.x = e.pageX;
                p.y = e.pageY;
            }
            else if (event.clientX || event.clientY)
            {
                p.x = e.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
                p.y = e.clientY + document.body.scrollTop + document.documentElement.scrollTop;
            }
            return p;            
        }
    }
    //export namespace Node
    {
        // Append an arbitrary block of HTML to an existing element
        /*export function AppendHTML(node: HTMLElement, html: string) : HTMLElement
        {
            var child = CreateHTML(html);
            node.appendChild(child);
            return child;
        }*/

        // Append a div that clears the float style
        /*export function AppendClearFloat(node: HTMLElement) : HTMLElement
        {
            var child = document.createElement("div");
            child.style.clear = "both";
            node.appendChild(child);
            return child;
        }*/
    }
}
