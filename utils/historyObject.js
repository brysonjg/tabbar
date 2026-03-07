class VersionObject {
    constructor(object) {
        // check sum
        if (object === null || typeof object !== 'object') {
            throw new Error("object's (input to historyObject) primitive type is not Object.");
        }
        if (Object.getPrototypeOf(object) !== Object.prototype) {
            throw new Error("object's (input to historyObject) prototype is not Object.");
        }

        if (!Object.prototype.hasOwnProperty.call(object, "active")) {
            throw new Error("object (input to historyObject) dose not own the required pointer (\"active\")");
        }

        const keys = Object.keys(object)
                         .filter(key => key !== "active");

        let invalidate = keys.some(key =>
            String(Number(key)) !== key
        );

        if (invalidate) {
            throw new Error(`(historyObject): Structural validation failed, and the object was invalidated. A key was not a Number.`);
        }

        invalidate = false;

        keys.forEach((key) => {
            let value = object[key];
            if (value === null || typeof value !== 'object') {
                invalidate = true;
            }
            if (Object.getPrototypeOf(value) !== Object.prototype) {
                invalidate = true;
            }
        });

        if (invalidate) {
            throw new Error(`(historyObject): Structural validation failed, and the object was invalidated. A vlaue was not an Object.`);
        }

        invalidate = false;

        const activePointer = object.active;

        if (typeof activePointer !== 'number') {
            throw new Error(`(historyObject): Structural validation failed, and the object was invalidated. A the active pointer was not a Number.`);
        }

        if (!Object.prototype.hasOwnProperty.call(object, activePointer)) {
            throw new Error(`(historyObject): Structural validation failed, the active pointer points to an location that isnt in the object.`);
        }

        if (!Object.prototype.hasOwnProperty.call(object, 0)) {
            throw new Error(`(historyObject): Structural validation failed, the Root location is null.`);
        }

        keys.forEach((key) => {
            // the folowing exception for 0 is becouses as the root it has no parent
            if (key != 0) {
                let value = object[key];
                if (!Object.prototype.hasOwnProperty.call(object, value.parent)) {
                    // if ever the parent of a node is not another key (excluding the root 0)
                    invalidate = true;
                }
            }
        });

        if (invalidate) {
            throw new Error(`(historyObject): Structural validation failed, node links to id that dosent exist.`);
        }

        invalidate = false;

        keys.forEach((key) => {
            let value = object[key];
            if (!Object.prototype.hasOwnProperty.call(value, "children")) {
                invalidate = true;
            }
            else {
                if (!(typeof value.children == 'object')) {
                    invalidate = true;
                }
                if (!(value.children instanceof Array)) {
                    invalidate = true;
                }
            }
        });

        if (invalidate) {
            throw new Error(`(historyObject): Structural validation failed, node dosent contain Array[] children.`);
        }

        invalidate = false;

        keys.forEach((key) => {
            let value = object[key];
            if (!Object.prototype.hasOwnProperty.call(value, "content")) {
                invalidate = true;
            }
            else {
                if (!(typeof value.content == 'object')) {
                    invalidate = true;
                }
                if (!(value.content instanceof Array)) {
                    invalidate = true;
                }
            }
        });

        if (invalidate) {
            throw new Error(`(historyObject): Structural validation failed, node dosent contain Array[] content.`);
        }

        // asigning values
        this.active = activePointer;
        this.json = object;
        this.object = object;

        const keyVals = Object.keys(object);
        let nKeys = [];

        keyVals.forEach((key) => {
            if (key !== "active") {
                nKeys.push(Number(key));
            }
        });

        this.keys = nKeys;
        this._nextId = Math.max(...this.keys) + 1;
    }
    commit(array) {
        // Validate active pointer
        if (!this.keys.includes(this.active)) {
            throw new Error("commit(): active pointer is invalid.");
        }

        // Validate input
        if (!Array.isArray(array)) {
            throw new Error("commit(): argument must be an array.");
        }

        const current = this.object[this.active];

        // Generate next numeric ID safely
        const newId = this._nextId++;

        // Create new node
        this.object[newId] = {
            parent: this.active,
            content: [...array], // defensive copy
            children: []
        };

        // Link parent to child
        current.children.push(newId);

        // Move active pointer
        this.active = newId;
        this.object.active = newId;

        // Track key
        this.keys.push(newId);

        return newId;
    }
    checkout(id) {
        // switch the head to an id after varification

        // verify that id is a node
        if (!this.keys.includes(id)) {
            throw new Error("checkout(): id must me a valid id inside the list of keys.");
        }
        // set head to it
        this.active = id;
        this.object.active = id;
    }
    compile() {
        if (!this.keys.includes(this.active)) {
            throw new Error("compile(): active pointer is invalid.");
        }

        let result = [];
        let cursor = this.active;

        // Traverse upward to root
        const stack = [];
        while (cursor !== null) {
            stack.push(cursor);
            cursor = this.object[cursor].parent;
        }

        // Reverse to go root → active
        stack.reverse();

        for (const id of stack) {
            result.push(...this.object[id].content);
        }

        return result;
    }
    deleteHead(id) {
        if (id === 0) {
            throw new Error("deleteHead(): cannot delete root node.");
        }

        if (!this.keys.includes(id)) {
            throw new Error("deleteHead(): invalid id.");
        }

        if (this.active === id) {
            throw new Error("deleteHead(): cannot delete active head.");
        }

        const node = this.object[id];
        const parent = this.object[node.parent];

        // Remove from parent's children
        parent.children = parent.children.filter(childId => childId !== id);

        // Remove node
        delete this.object[id];

        // Remove from keys
        this.keys = this.keys.filter(key => key !== id);
    }
    garbageCollect() {
        const reachable = new Set();

        // DFS from root
        const stack = [0];

        while (stack.length > 0) {
            const id = stack.pop();
            if (reachable.has(id)) continue;

            reachable.add(id);

            const node = this.object[id];
            node.children.forEach(childId => {
                if (this.object[childId]) {
                    stack.push(childId);
                }
            });
        }

        // Delete unreachable nodes
        this.keys.forEach(id => {
            if (!reachable.has(id)) {
                delete this.object[id];
            }
        });

        // Rebuild keys
        this.keys = this.keys.filter(id => reachable.has(id));
    }
    static newRepository() {
        return {
                   0:
                       {
                           parent: null,
                           content: [],
                           children: [],
                       },
                    active:
                       0
               };
    }
}

class VersionPanel {
    constructor(element, object, argument={}) {
        this.parentElement = element;
        this.veringObject = object;
        this.nodeHitRegions = [];
        this._clickListener = null;

        const canvas = document.createElement("canvas");
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        canvas.style.background = "transparent";
        canvas.style.display = "block";

        element.replaceChildren(canvas);

        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");

        this.dpr = window.devicePixelRatio || 1;

        const documentStyles = window.getComputedStyle(document.body);
        let colorPalet = [];
        let colorPaletItorator = 0;
        const charSet = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_";

        while (true) {
            let currentID = "";

            if (colorPaletItorator > 0) {
                let n = colorPaletItorator;

                while (n > 0) {
                    const remainder = n % 64;
                    currentID = charSet[remainder] + currentID;
                    n = Math.floor(n / 64);
                }
            } else currentID = "0";


            const variableName = `--versioning-graph-${currentID}`;
            const value = documentStyles.getPropertyValue(variableName).trim();

            if (!value) break;

            colorPalet.push(value);
            colorPaletItorator++;
        }

        this.arcv = {
            padding: 7,
            gridCellSurface: 20,
            colorPalet: [...colorPalet],
            ...argument
        };

        this.resizeObserver = new ResizeObserver(() => {
            this.autoResizeCanvas();
        });

        this.resizeObserver.observe(element);
        this.autoResizeCanvas();
    }

    _getColorIDOfItorater(iter) {
        const charSet = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_";

        if (iter === 0) return charSet[0];

        let result = "";
        let n = iter;

        while (n > 0) {
            const remainder = n % 64;
            result = charSet[remainder] + result;
            n = Math.floor(n / 64);
        }

        return result;
    }

    listenForClick(callback) {
        if (typeof callback !== "function") {
            throw new Error("listenForClick(): callback must be a function.");
        }

        if (this._clickListener) {
            document.removeEventListener("click", this._clickListener);
        }

        this._clickListener = async (event) => {
            if (event.target !== this.canvas) {
                return;
            }

            const rect = this.canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;

            const hit = this.nodeHitRegions.find((node) => {
                const dx = x - node.x;
                const dy = y - node.y;
                return (dx * dx + dy * dy) <= (node.r * node.r);
            });

            if (hit) {
                try {
                    await callback(hit.id);
                }
                catch (error) {
                    console.error("listenForClick(): callback failed.", error);
                }
            }
        };

        document.addEventListener("click", this._clickListener);

        return () => {
            if (this._clickListener) {
                document.removeEventListener("click", this._clickListener);
                this._clickListener = null;
            }
        };
    }

    autoResizeCanvas() {
        const rect = this.parentElement.getBoundingClientRect();
        const canvas = this.canvas;

        canvas.width = rect.width * this.dpr;
        canvas.height = rect.height * this.dpr;

        canvas.style.width = rect.width + "px";
        canvas.style.height = rect.height + "px";

        this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

        if (this.veringObject) {
            this.displayObject(this.veringObject);
        }
    }

    _canvasCircle(xStart, yStart, xEnd, yEnd) {
        const centerX = (xStart + xEnd) / 2;
        const centerY = (yStart + yEnd) / 2;
        const radiusX = Math.abs(xEnd - xStart) / 2;
        const radiusY = Math.abs(yEnd - yStart) / 2;

        this.ctx.beginPath();
        this.ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
        this.ctx.fill();
    }

    _conectNodes(startIndex, endIndex, startY) {
        const padding = this.arcv.padding;
        const cellSize = this.arcv.gridCellSurface;

        const x1 = (startIndex + 0.5) * cellSize + (startIndex + 1) * padding;
        const y1 = startY + cellSize;
        const x2 = (endIndex + 0.5) * cellSize + (endIndex + 1) * padding;
        const y2 = startY + padding + cellSize; // connect to bottom of parent circle

        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
    }

    displayObject() {
        const padding = this.arcv.padding;
        const cellSize = this.arcv.gridCellSurface;
        const colors = this.arcv.colorPalet;
        const object = this.veringObject
        const radius = cellSize / 2;
        this.nodeHitRegions = [];

        // clear the screen
        this.ctx.clearRect(0, 0, this.canvas.width / this.dpr, this.canvas.height / this.dpr);

        let pointers = [0];  // nodes in this row
        let drawY = 0;
        let positions = []; // x positions of nodes

        while (pointers.length > 0) {
            let drawX = 0;
            let newPointers = [];
            let newPositions = [];

            drawY += padding;

            pointers.forEach((nodeId, i) => {
                const x = drawX + padding + cellSize / 2;
                const y = drawY + cellSize / 2;
                positions[i] = x;

                this.ctx.fillStyle = colors[i % colors.length];
                this.ctx.strokeStyle = colors[i % colors.length];

                this._canvasCircle(drawX + padding, drawY, drawX + padding + cellSize, drawY + cellSize);
                this.nodeHitRegions.push({
                    id: nodeId,
                    x,
                    y,
                    r: radius,
                });

                const node = object[nodeId];
                node.children.forEach((child) => {
                    newPointers.push(child);
                });

                node.children.forEach((child, j) => {
                    const childIndex = newPointers.indexOf(child);
                    if (childIndex !== -1) {
                        this._conectNodes(i, childIndex, drawY);
                    }
                });

                drawX += cellSize + padding;
            });

            pointers = newPointers;
            positions = newPositions;
            drawY += cellSize;
        }
    }

    setRenderObject(object) {
        this.veringObject = object;
        this.displayObject();
    }
}
