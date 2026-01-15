/**
 * TSCN (Text Scene) Parser for Godot 4.x
 *
 * Parses and serializes Godot's text-based scene format.
 * Reference: https://docs.godotengine.org/en/stable/contributing/development/file_formats/tscn.html
 */
export class TscnParser {
    /**
     * Parse a TSCN file content into structured data
     */
    static parse(content) {
        const lines = content.split("\n");
        let index = 0;
        const result = {
            header: { type: "gd_scene", format: 3 },
            externalResources: [],
            subResources: [],
            nodes: [],
            connections: [],
        };
        while (index < lines.length) {
            const line = lines[index].trim();
            if (line.startsWith("[gd_scene") || line.startsWith("[gd_resource")) {
                result.header = this.parseHeader(line);
                index++;
            }
            else if (line.startsWith("[ext_resource")) {
                result.externalResources.push(this.parseExtResource(line));
                index++;
            }
            else if (line.startsWith("[sub_resource")) {
                const { subResource, newIndex } = this.parseSubResource(lines, index);
                result.subResources.push(subResource);
                index = newIndex;
            }
            else if (line.startsWith("[node")) {
                const { node, newIndex } = this.parseNode(lines, index);
                result.nodes.push(node);
                index = newIndex;
            }
            else if (line.startsWith("[connection")) {
                result.connections.push(this.parseConnection(line));
                index++;
            }
            else {
                index++;
            }
        }
        return result;
    }
    /**
     * Serialize structured scene data back to TSCN format
     */
    static serialize(scene) {
        const lines = [];
        // Header
        lines.push(this.serializeHeader(scene.header));
        lines.push("");
        // External resources
        for (const extRes of scene.externalResources) {
            lines.push(this.serializeExtResource(extRes));
        }
        if (scene.externalResources.length > 0) {
            lines.push("");
        }
        // Sub-resources
        for (const subRes of scene.subResources) {
            lines.push(...this.serializeSubResource(subRes));
            lines.push("");
        }
        // Nodes
        for (const node of scene.nodes) {
            lines.push(...this.serializeNode(node));
            lines.push("");
        }
        // Connections
        for (const connection of scene.connections) {
            lines.push(this.serializeConnection(connection));
        }
        return lines.join("\n").trim() + "\n";
    }
    // Header parsing
    static parseHeader(line) {
        const type = line.startsWith("[gd_scene") ? "gd_scene" : "gd_resource";
        const attrs = this.parseAttributes(line);
        return {
            type,
            loadSteps: attrs.load_steps ? parseInt(attrs.load_steps, 10) : undefined,
            format: attrs.format ? parseInt(attrs.format, 10) : 3,
            uid: attrs.uid,
        };
    }
    static serializeHeader(header) {
        const parts = [`[${header.type}`];
        if (header.loadSteps) {
            parts.push(`load_steps=${header.loadSteps}`);
        }
        parts.push(`format=${header.format}`);
        if (header.uid) {
            parts.push(`uid="${header.uid}"`);
        }
        return parts.join(" ") + "]";
    }
    // External resource parsing
    static parseExtResource(line) {
        const attrs = this.parseAttributes(line);
        return {
            type: attrs.type || "",
            path: attrs.path || "",
            id: attrs.id || "",
            uid: attrs.uid,
        };
    }
    static serializeExtResource(res) {
        let result = `[ext_resource type="${res.type}" path="${res.path}"`;
        if (res.uid) {
            result += ` uid="${res.uid}"`;
        }
        result += ` id="${res.id}"]`;
        return result;
    }
    // Sub-resource parsing
    static parseSubResource(lines, startIndex) {
        const headerLine = lines[startIndex].trim();
        const attrs = this.parseAttributes(headerLine);
        const subResource = {
            type: attrs.type || "",
            id: attrs.id || "",
            properties: {},
        };
        let index = startIndex + 1;
        while (index < lines.length) {
            const line = lines[index].trim();
            if (line === "" || line.startsWith("[")) {
                break;
            }
            const { key, value } = this.parseProperty(line);
            if (key) {
                subResource.properties[key] = value;
            }
            index++;
        }
        return { subResource, newIndex: index };
    }
    static serializeSubResource(res) {
        const lines = [];
        lines.push(`[sub_resource type="${res.type}" id="${res.id}"]`);
        for (const [key, value] of Object.entries(res.properties)) {
            lines.push(`${key} = ${this.serializeValue(value)}`);
        }
        return lines;
    }
    // Node parsing
    static parseNode(lines, startIndex) {
        const headerLine = lines[startIndex].trim();
        const attrs = this.parseAttributes(headerLine);
        const node = {
            name: attrs.name || "",
            type: attrs.type,
            parent: attrs.parent,
            instance: attrs.instance,
            instancePlaceholder: attrs.instance_placeholder,
            owner: attrs.owner,
            index: attrs.index ? parseInt(attrs.index, 10) : undefined,
            groups: attrs.groups ? this.parseArray(attrs.groups) : undefined,
            properties: {},
        };
        let index = startIndex + 1;
        while (index < lines.length) {
            const line = lines[index].trim();
            if (line === "" || line.startsWith("[")) {
                break;
            }
            const { key, value } = this.parseProperty(line);
            if (key) {
                node.properties[key] = value;
            }
            index++;
        }
        return { node, newIndex: index };
    }
    static serializeNode(node) {
        const lines = [];
        let header = `[node name="${node.name}"`;
        if (node.type) {
            header += ` type="${node.type}"`;
        }
        if (node.parent !== undefined) {
            header += ` parent="${node.parent}"`;
        }
        if (node.instance) {
            header += ` instance=${node.instance}`;
        }
        if (node.instancePlaceholder) {
            header += ` instance_placeholder="${node.instancePlaceholder}"`;
        }
        if (node.owner) {
            header += ` owner="${node.owner}"`;
        }
        if (node.index !== undefined) {
            header += ` index=${node.index}`;
        }
        if (node.groups && node.groups.length > 0) {
            header += ` groups=${this.serializeValue(node.groups)}`;
        }
        header += "]";
        lines.push(header);
        for (const [key, value] of Object.entries(node.properties)) {
            lines.push(`${key} = ${this.serializeValue(value)}`);
        }
        return lines;
    }
    // Connection parsing
    static parseConnection(line) {
        const attrs = this.parseAttributes(line);
        return {
            signal: attrs.signal || "",
            from: attrs.from || "",
            to: attrs.to || "",
            method: attrs.method || "",
            flags: attrs.flags ? parseInt(attrs.flags, 10) : undefined,
            binds: attrs.binds ? this.parseArray(attrs.binds) : undefined,
        };
    }
    static serializeConnection(conn) {
        let result = `[connection signal="${conn.signal}" from="${conn.from}" to="${conn.to}" method="${conn.method}"`;
        if (conn.flags !== undefined) {
            result += ` flags=${conn.flags}`;
        }
        if (conn.binds && conn.binds.length > 0) {
            result += ` binds=${this.serializeValue(conn.binds)}`;
        }
        result += "]";
        return result;
    }
    // Utility methods
    static parseAttributes(line) {
        const attrs = {};
        // Match key="value", key=[array], or key=value patterns
        const regex = /(\w+)=(?:"([^"]*)"|(\[[^\]]*\])|([^\s\]]+))/g;
        let match;
        while ((match = regex.exec(line)) !== null) {
            const key = match[1];
            // Priority: quoted string, then array, then unquoted value
            const value = match[2] !== undefined ? match[2] : (match[3] !== undefined ? match[3] : match[4]);
            attrs[key] = value;
        }
        return attrs;
    }
    static parseProperty(line) {
        const eqIndex = line.indexOf("=");
        if (eqIndex === -1) {
            return { key: "", value: null };
        }
        const key = line.substring(0, eqIndex).trim();
        const valueStr = line.substring(eqIndex + 1).trim();
        return { key, value: this.parseValue(valueStr) };
    }
    static parseValue(str) {
        str = str.trim();
        // Null
        if (str === "null")
            return null;
        // Boolean
        if (str === "true")
            return true;
        if (str === "false")
            return false;
        // String
        if (str.startsWith('"') && str.endsWith('"')) {
            return str.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
        }
        // Number
        if (/^-?\d+$/.test(str)) {
            return parseInt(str, 10);
        }
        if (/^-?\d+\.\d+$/.test(str)) {
            return parseFloat(str);
        }
        // Vector2
        if (str.startsWith("Vector2(")) {
            const inner = str.slice(8, -1);
            const [x, y] = inner.split(",").map((s) => parseFloat(s.trim()));
            return { _type: "Vector2", x, y };
        }
        // Vector3
        if (str.startsWith("Vector3(")) {
            const inner = str.slice(8, -1);
            const [x, y, z] = inner.split(",").map((s) => parseFloat(s.trim()));
            return { _type: "Vector3", x, y, z };
        }
        // Color
        if (str.startsWith("Color(")) {
            const inner = str.slice(6, -1);
            const [r, g, b, a] = inner.split(",").map((s) => parseFloat(s.trim()));
            return { _type: "Color", r, g, b, a: a ?? 1.0 };
        }
        // ExtResource reference
        if (str.startsWith("ExtResource(")) {
            const id = str.slice(12, -1).replace(/"/g, "");
            return { _type: "ExtResource", id };
        }
        // SubResource reference
        if (str.startsWith("SubResource(")) {
            const id = str.slice(12, -1).replace(/"/g, "");
            return { _type: "SubResource", id };
        }
        // NodePath
        if (str.startsWith("NodePath(")) {
            const path = str.slice(9, -1).replace(/"/g, "");
            return { _type: "NodePath", path };
        }
        // Array
        if (str.startsWith("[")) {
            return this.parseArray(str);
        }
        // Dictionary
        if (str.startsWith("{")) {
            return this.parseDictionary(str);
        }
        // Return as string if unknown
        return str;
    }
    static parseArray(str) {
        str = str.trim();
        if (!str.startsWith("[") || !str.endsWith("]")) {
            return [];
        }
        const inner = str.slice(1, -1).trim();
        if (inner === "")
            return [];
        const result = [];
        let depth = 0;
        let current = "";
        let inString = false;
        for (let i = 0; i < inner.length; i++) {
            const char = inner[i];
            if (char === '"' && inner[i - 1] !== "\\") {
                inString = !inString;
            }
            if (!inString) {
                if (char === "[" || char === "{" || char === "(")
                    depth++;
                if (char === "]" || char === "}" || char === ")")
                    depth--;
                if (char === "," && depth === 0) {
                    result.push(this.parseValue(current.trim()));
                    current = "";
                    continue;
                }
            }
            current += char;
        }
        if (current.trim()) {
            result.push(this.parseValue(current.trim()));
        }
        return result;
    }
    static parseDictionary(str) {
        str = str.trim();
        if (!str.startsWith("{") || !str.endsWith("}")) {
            return {};
        }
        const inner = str.slice(1, -1).trim();
        if (inner === "")
            return {};
        const result = {};
        let depth = 0;
        let current = "";
        let inString = false;
        const pairs = [];
        for (let i = 0; i < inner.length; i++) {
            const char = inner[i];
            if (char === '"' && inner[i - 1] !== "\\") {
                inString = !inString;
            }
            if (!inString) {
                if (char === "[" || char === "{" || char === "(")
                    depth++;
                if (char === "]" || char === "}" || char === ")")
                    depth--;
                if (char === "," && depth === 0) {
                    pairs.push(current.trim());
                    current = "";
                    continue;
                }
            }
            current += char;
        }
        if (current.trim()) {
            pairs.push(current.trim());
        }
        for (const pair of pairs) {
            const colonIndex = pair.indexOf(":");
            if (colonIndex !== -1) {
                const key = this.parseValue(pair.substring(0, colonIndex).trim());
                const value = this.parseValue(pair.substring(colonIndex + 1).trim());
                result[String(key)] = value;
            }
        }
        return result;
    }
    static serializeValue(value) {
        if (value === null)
            return "null";
        if (typeof value === "boolean")
            return value ? "true" : "false";
        if (typeof value === "number")
            return String(value);
        if (typeof value === "string") {
            // Check if it's already a Godot value format (ExtResource, Vector2, etc.)
            if (this.isGodotValueString(value)) {
                return value;
            }
            return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
        }
        if (Array.isArray(value)) {
            const items = value.map((v) => this.serializeValue(v));
            return `[${items.join(", ")}]`;
        }
        if (typeof value === "object" && value !== null) {
            const obj = value;
            // Special types with explicit _type
            if (obj._type === "Vector2") {
                return `Vector2(${obj.x}, ${obj.y})`;
            }
            if (obj._type === "Vector3") {
                return `Vector3(${obj.x}, ${obj.y}, ${obj.z})`;
            }
            if (obj._type === "Color") {
                return `Color(${obj.r}, ${obj.g}, ${obj.b}, ${obj.a})`;
            }
            if (obj._type === "ExtResource") {
                return `ExtResource("${obj.id}")`;
            }
            if (obj._type === "SubResource") {
                return `SubResource("${obj.id}")`;
            }
            if (obj._type === "NodePath") {
                return `NodePath("${obj.path}")`;
            }
            // Auto-detect Vector2 (has x, y, no z, no _type)
            const keys = Object.keys(obj);
            if (keys.length === 2 && 'x' in obj && 'y' in obj && typeof obj.x === 'number' && typeof obj.y === 'number') {
                return `Vector2(${obj.x}, ${obj.y})`;
            }
            // Auto-detect Vector3 (has x, y, z, no _type)
            if (keys.length === 3 && 'x' in obj && 'y' in obj && 'z' in obj &&
                typeof obj.x === 'number' && typeof obj.y === 'number' && typeof obj.z === 'number') {
                return `Vector3(${obj.x}, ${obj.y}, ${obj.z})`;
            }
            // Auto-detect Color (has r, g, b, optionally a)
            if (('r' in obj && 'g' in obj && 'b' in obj) &&
                typeof obj.r === 'number' && typeof obj.g === 'number' && typeof obj.b === 'number') {
                const a = typeof obj.a === 'number' ? obj.a : 1.0;
                return `Color(${obj.r}, ${obj.g}, ${obj.b}, ${a})`;
            }
            // Regular dictionary (filter out internal _type if present)
            const pairs = Object.entries(obj)
                .filter(([k]) => !k.startsWith('_'))
                .map(([k, v]) => `${this.serializeValue(k)}: ${this.serializeValue(v)}`);
            return `{${pairs.join(", ")}}`;
        }
        return String(value);
    }
    /**
     * Check if a string is already in Godot value format
     */
    static isGodotValueString(str) {
        const patterns = [
            /^ExtResource\s*\(/,
            /^SubResource\s*\(/,
            /^Vector2\s*\(/,
            /^Vector3\s*\(/,
            /^Color\s*\(/,
            /^NodePath\s*\(/,
            /^Rect2\s*\(/,
            /^Transform2D\s*\(/,
            /^Transform3D\s*\(/,
            /^Basis\s*\(/,
            /^Quaternion\s*\(/,
            /^AABB\s*\(/,
            /^Plane\s*\(/,
        ];
        return patterns.some(pattern => pattern.test(str));
    }
    /**
     * Add a node to a parsed scene
     */
    static addNode(scene, node) {
        scene.nodes.push({
            ...node,
            properties: node.properties || {},
        });
        // Update load_steps in header
        this.updateLoadSteps(scene);
    }
    /**
     * Remove a node from a parsed scene (and its children)
     */
    static removeNode(scene, nodePath) {
        // Build the full path for the node
        const getNodePath = (node) => {
            if (!node.parent)
                return node.name;
            if (node.parent === ".")
                return node.name;
            return `${node.parent}/${node.name}`;
        };
        // Find nodes to remove (the node and all children)
        const pathsToRemove = new Set();
        pathsToRemove.add(nodePath);
        // Find children
        for (const node of scene.nodes) {
            const path = getNodePath(node);
            if (path.startsWith(nodePath + "/") || node.parent?.startsWith(nodePath)) {
                pathsToRemove.add(path);
            }
        }
        // Remove nodes
        scene.nodes = scene.nodes.filter((node) => {
            const path = getNodePath(node);
            return !pathsToRemove.has(path);
        });
        // Remove connections involving removed nodes
        scene.connections = scene.connections.filter((conn) => !pathsToRemove.has(conn.from) && !pathsToRemove.has(conn.to));
        this.updateLoadSteps(scene);
    }
    /**
     * Modify a node's properties
     */
    static modifyNode(scene, nodePath, updates) {
        const getNodePath = (node) => {
            if (!node.parent)
                return node.name;
            if (node.parent === ".")
                return node.name;
            return `${node.parent}/${node.name}`;
        };
        const node = scene.nodes.find((n) => getNodePath(n) === nodePath);
        if (!node)
            return false;
        if (updates.name !== undefined)
            node.name = updates.name;
        if (updates.type !== undefined)
            node.type = updates.type;
        if (updates.groups !== undefined)
            node.groups = updates.groups;
        if (updates.properties !== undefined) {
            node.properties = { ...node.properties, ...updates.properties };
        }
        return true;
    }
    /**
     * Get the scene tree as a hierarchical structure
     */
    static getSceneTree(scene) {
        const root = {};
        for (const node of scene.nodes) {
            const path = node.parent ? `${node.parent}/${node.name}` : node.name;
            const parts = node.parent ? node.parent.split("/").filter(Boolean) : [];
            let current = root;
            for (const part of parts) {
                if (!current[part]) {
                    current[part] = { _children: {} };
                }
                current = current[part]._children;
            }
            current[node.name] = {
                type: node.type,
                properties: node.properties,
                _children: {},
            };
        }
        return root;
    }
    static updateLoadSteps(scene) {
        scene.header.loadSteps =
            scene.externalResources.length + scene.subResources.length + 1;
    }
}
//# sourceMappingURL=tscn-parser.js.map