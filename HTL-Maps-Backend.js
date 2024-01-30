// To parse this data:
//
//   const Convert = require("./file");
//
//   const schoolInfrastructur = Convert.toSchoolInfrastructur(json);
//
// These functions will throw an error if the JSON doesn't
// match the expected interface, even if the JSON is valid.

// Converts JSON strings to/from your types
// and asserts the results of JSON.parse at runtime
function toSchoolInfrastructur(json) {
    return cast(JSON.parse(json), a(r("SchoolInfrastructur")));
}

function schoolInfrastructurToJson(value) {
    return JSON.stringify(uncast(value, a(r("SchoolInfrastructur"))), null, 2);
}

function invalidValue(typ, val, key, parent = '') {
    const prettyTyp = prettyTypeName(typ);
    const parentText = parent ? ` on ${parent}` : '';
    const keyText = key ? ` for key "${key}"` : '';
    throw Error(`Invalid value${keyText}${parentText}. Expected ${prettyTyp} but got ${JSON.stringify(val)}`);
}

function prettyTypeName(typ) {
    if (Array.isArray(typ)) {
        if (typ.length === 2 && typ[0] === undefined) {
            return `an optional ${prettyTypeName(typ[1])}`;
        } else {
            return `one of [${typ.map(a => { return prettyTypeName(a); }).join(", ")}]`;
        }
    } else if (typeof typ === "object" && typ.literal !== undefined) {
        return typ.literal;
    } else {
        return typeof typ;
    }
}

function jsonToJSProps(typ) {
    if (typ.jsonToJS === undefined) {
        const map = {};
        typ.props.forEach((p) => map[p.json] = { key: p.js, typ: p.typ });
        typ.jsonToJS = map;
    }
    return typ.jsonToJS;
}

function jsToJSONProps(typ) {
    if (typ.jsToJSON === undefined) {
        const map = {};
        typ.props.forEach((p) => map[p.js] = { key: p.json, typ: p.typ });
        typ.jsToJSON = map;
    }
    return typ.jsToJSON;
}

function transform(val, typ, getProps, key = '', parent = '') {
    function transformPrimitive(typ, val) {
        if (typeof typ === typeof val) return val;
        return invalidValue(typ, val, key, parent);
    }

    function transformUnion(typs, val) {
        // val must validate against one typ in typs
        const l = typs.length;
        for (let i = 0; i < l; i++) {
            const typ = typs[i];
            try {
                return transform(val, typ, getProps);
            } catch (_) {}
        }
        return invalidValue(typs, val, key, parent);
    }

    function transformEnum(cases, val) {
        if (cases.indexOf(val) !== -1) return val;
        return invalidValue(cases.map(a => { return l(a); }), val, key, parent);
    }

    function transformArray(typ, val) {
        // val must be an array with no invalid elements
        if (!Array.isArray(val)) return invalidValue(l("array"), val, key, parent);
        return val.map(el => transform(el, typ, getProps));
    }

    function transformDate(val) {
        if (val === null) {
            return null;
        }
        const d = new Date(val);
        if (isNaN(d.valueOf())) {
            return invalidValue(l("Date"), val, key, parent);
        }
        return d;
    }

    function transformObject(props, additional, val) {
        if (val === null || typeof val !== "object" || Array.isArray(val)) {
            return invalidValue(l(ref || "object"), val, key, parent);
        }
        const result = {};
        Object.getOwnPropertyNames(props).forEach(key => {
            const prop = props[key];
            const v = Object.prototype.hasOwnProperty.call(val, key) ? val[key] : undefined;
            result[prop.key] = transform(v, prop.typ, getProps, key, ref);
        });
        Object.getOwnPropertyNames(val).forEach(key => {
            if (!Object.prototype.hasOwnProperty.call(props, key)) {
                result[key] = transform(val[key], additional, getProps, key, ref);
            }
        });
        return result;
    }

    if (typ === "any") return val;
    if (typ === null) {
        if (val === null) return val;
        return invalidValue(typ, val, key, parent);
    }
    if (typ === false) return invalidValue(typ, val, key, parent);
    let ref = undefined;
    while (typeof typ === "object" && typ.ref !== undefined) {
        ref = typ.ref;
        typ = typeMap[typ.ref];
    }
    if (Array.isArray(typ)) return transformEnum(typ, val);
    if (typeof typ === "object") {
        return typ.hasOwnProperty("unionMembers") ? transformUnion(typ.unionMembers, val)
            : typ.hasOwnProperty("arrayItems")    ? transformArray(typ.arrayItems, val)
            : typ.hasOwnProperty("props")         ? transformObject(getProps(typ), typ.additional, val)
            : invalidValue(typ, val, key, parent);
    }
    // Numbers can be parsed by Date but shouldn't be.
    if (typ === Date && typeof val !== "number") return transformDate(val);
    return transformPrimitive(typ, val);
}

function cast(val, typ) {
    return transform(val, typ, jsonToJSProps);
}

function uncast(val, typ) {
    return transform(val, typ, jsToJSONProps);
}

function l(typ) {
    return { literal: typ };
}

function a(typ) {
    return { arrayItems: typ };
}

function u(...typs) {
    return { unionMembers: typs };
}

function o(props, additional) {
    return { props, additional };
}

function m(additional) {
    return { props: [], additional };
}

function r(name) {
    return { ref: name };
}

const typeMap = {
    "SchoolInfrastructur": o([
        { json: "schoolName", js: "schoolName", typ: "" },
        { json: "version", js: "version", typ: 0 },
        { json: "author", js: "author", typ: "" },
        { json: "lastEdited", js: "lastEdited", typ: "" },
        { json: "buildings", js: "buildings", typ: a(r("Building")) },
        { json: "levelBackgrounds", js: "levelBackgrounds", typ: a("") },
    ], false),
    "Building": o([
        { json: "name", js: "name", typ: "" },
        { json: "floors", js: "floors", typ: a(r("Floor")) },
    ], false),
    "Floor": o([
        { json: "level", js: "level", typ: 0 },
        { json: "rooms", js: "rooms", typ: a(r("Accessory")) },
        { json: "paths", js: "paths", typ: a(r("Path")) },
        { json: "accessories", js: "accessories", typ: a(r("Accessory")) },
    ], false),
    "Accessory": o([
        { json: "type", js: "type", typ: u(undefined, "") },
        { json: "name", js: "name", typ: "" },
        { json: "id", js: "id", typ: 0 },
        { json: "tags", js: "tags", typ: a("") },
        { json: "x", js: "x", typ: 0 },
        { json: "y", js: "y", typ: 0 },
        { json: "longName", js: "longName", typ: u(undefined, "") },
    ], false),
    "Path": o([
        { json: "id", js: "id", typ: 0 },
        { json: "walkDuration", js: "walkDuration", typ: 0 },
        { json: "x1", js: "x1", typ: 0 },
        { json: "y1", js: "y1", typ: 0 },
        { json: "x2", js: "x2", typ: 0 },
        { json: "y2", js: "y2", typ: 0 },
        { json: "type", js: "type", typ: "" },
    ], false),
};

module.exports = {
    "schoolInfrastructurToJson": schoolInfrastructurToJson,
    "toSchoolInfrastructur": toSchoolInfrastructur,
};
