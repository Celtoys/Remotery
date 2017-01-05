
namespace DOM
{
    export class Node
    {
        // DOM element this object controls
        Element: HTMLElement;

        // Optional DOM event handlers
        private _MouseDownEvent: DOMEvent;
        private _MouseUpEvent: DOMEvent;
        private _MouseMoveEvent: DOMEvent;
        private _ResizeEvent: DOMEvent;


        // ----- Constructor ---------------------------------------------------------------


        constructor(parameter: string | Element | Document | EventTarget, index?: number)
        {
            // If no index is provided replace with the first one 
            if (index === undefined)
                index = 0;

            // Take control of DOM objects
            if (parameter instanceof Element)
            {
                this.Element = <HTMLElement>parameter;
            }
            else if (parameter instanceof Document)
            {
                this.Element = <HTMLElement>parameter.documentElement;
            }
            else if (parameter instanceof EventTarget)
            {
                this.Element = <HTMLElement>parameter;
            }
            else if (typeof parameter === "string")
            {
                // TODO: querySelector?

                // Global ID search
                if (parameter[0] == "#")
                    this.Element = document.getElementById(parameter.slice(1));

                // Global class search
                else if (parameter[0] == ".")
                    this.Element = <HTMLElement>document.getElementsByClassName(parameter.slice(1))[index];

                // Create a node from the provided HTML
                else
                    this.SetHTML(parameter);
            }
        }


        // ----- Properties ----------------------------------------------------------------
        

        // Absolute position of a HTML element on the page
        get Position() : int2
        {
            // Recurse up through parents, summing offsets from their parents
            let pos = new int2();
            for (let node = this.Element; node != null; node = <HTMLElement>node.offsetParent)
            {
                pos.x += node.offsetLeft;
                pos.y += node.offsetTop;
            }
            return pos;
        }
        set Position(position: int2)
        {
            this.Element.style.left = position.x.toString();
            this.Element.style.top = position.y.toString();
        }

        // HTML element size, including borders and padding
        get Size() : int2
        {
            return new int2(this.Element.offsetWidth, this.Element.offsetHeight);
        }
        set Size(size: int2)
        {
            this.Element.style.width = size.x.toString();
            this.Element.style.height = size.y.toString();
        }

        // Rendering z-index, applied through CSS
        get ZIndex() : number
        {
            if (this.Element.style.zIndex.length)
                return parseInt(this.Element.style.zIndex);
            return null;
        }
        set ZIndex(z_index: number)
        {
            this.Element.style.zIndex = z_index.toString();
        }

        // Set HTML element opacity through CSS style
        set Opacity(value: number)
        {
            this.Element.style.opacity = value.toString();
        }

        // Set HTML element colour through CSS style
        set Colour(colour: string)
        {
            this.Element.style.color = colour;
        }

        set Cursor(cursor: string)
        {
            this.Element.style.cursor = cursor;
        }

        // Return the parent HTML node
        get Parent() : Node
        {
            if (this.Element.parentElement)
                return new Node(this.Element.parentElement);
            return null;  
        }


        // ----- Methods -------------------------------------------------------------------


        // Check to see if a HTML element contains a class
        HasClass(class_name: string) : boolean
        {
            let regexp = new RegExp("\\b" + class_name + "\\b");      
            return regexp.test(this.Element.className);  
        }

        // Remove a CSS class from a HTML element
        RemoveClass(class_name: string)
        {
            let regexp = new RegExp("\\b" + class_name + "\\b");
            this.Element.className = this.Element.className.replace(regexp, "");
        }

        // Add a CSS class to a HTML element, specified last
        AddClass(class_name: string)
        {
            if (!this.HasClass(class_name))
                this.Element.className += " " + class_name;
        }

        Find(filter: string, index?: number) : Node
        {
            // Split filter type
            let filter_type = filter[0];
            filter = filter.slice(1);

            // Set a default index
            if (index === undefined)
                index = 0;

            if (filter[0] == "#")
            {
                return $(Node.FindById(this.Element, filter, index));
            }

            else if (filter_type == ".")
            {
                let elements = this.Element.getElementsByClassName(filter);
                if (elements.length)
                {
                    return $(<HTMLElement>elements[index]);
                }
            }

            return null;
        }
        private static FindById(parent_node: HTMLElement, id: string, index?: number) : HTMLElement
        {
            // Search the children looking for a node with the given class name
            let matches_left = index;
            for (let i = 0; i < parent_node.children.length; i++)
            {
                let element = <HTMLElement>parent_node.children[i];
                if (element.id == id)
                {
                    if (index === undefined || matches_left-- == 0)
                        return element;
                }

                // Recurse into children
                element = Node.FindById(element, id, index);
                if (element != null)
                    return element;
            }

            return null;
        }

        Append(node: Node)
        {
            this.Element.appendChild(node.Element);    
        }

        Detach()
        {
            if (this.Element.parentNode)
                this.Element.parentNode.removeChild(this.Element);
        }

        // Create the HTML elements specified in the text parameter
        // Assumes there is only one root node in the text
        SetHTML(html: string)
        {
            // Create a temporary div to apply the HTML to
            let div = document.createElement("div");
            div.innerHTML = html;

            // First child may be a text node, followed by the created HTML
            var child = div.firstChild;
            if (child != null && child.nodeType == 3)
                child = child.nextSibling;
            this.Element = <HTMLElement>child;

            // Remove the generated HTML from the temporary div
            this.Detach();
        }

        Contains(node: Node) : boolean
        {
            while (node.Element != null && node.Element != this.Element)
                node = node.Parent;
            return node != null;            
        }


        // ----- Events --------------------------------------------------------------------


        // All event objects get created on-demand
        get MouseDownEvent() : DOMEvent
        {
            this._MouseDownEvent = this._MouseDownEvent || new DOMEvent(this.Element, "mousedown");
            return this._MouseDownEvent;
        }
        get MouseUpEvent() : DOMEvent
        {
            this._MouseUpEvent = this._MouseUpEvent || new DOMEvent(this.Element, "mouseup");
            return this._MouseUpEvent;
        }
        get MouseMoveEvent() : DOMEvent
        {
            this._MouseMoveEvent = this._MouseMoveEvent || new DOMEvent(this.Element, "mousemove");
            return this._MouseMoveEvent;
        }
        get ResizeEvent() : DOMEvent
        {
            this._ResizeEvent = this._ResizeEvent || new DOMEvent(window, "resize");
            return this._ResizeEvent;
        }
    };
}


// jQuery-style HTML element lookup which just passes straight onto DOM.Node constructor
function $(parameter: string | Element | Document | EventTarget, index?: number)
{
    return new DOM.Node(parameter, index);
}
