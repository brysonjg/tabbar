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
