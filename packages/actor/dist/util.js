var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var util_exports = {};
__export(util_exports, {
  IdentitySet: () => IdentitySet
});
module.exports = __toCommonJS(util_exports);
class IdentitySet {
  map = /* @__PURE__ */ new Map();
  idKey;
  constructor(idKey) {
    this.idKey = idKey;
  }
  add(value) {
    this.map.set(value[this.idKey], value);
    return this;
  }
  has(value) {
    return this.map.has(value[this.idKey]);
  }
  hasKey(key) {
    return this.map.has(key);
  }
  delete(value) {
    return this.map.delete(value[this.idKey]);
  }
  clear() {
    this.map.clear();
  }
  get size() {
    return this.map.size;
  }
  *[Symbol.iterator]() {
    yield* this.map.values();
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  IdentitySet
});
//# sourceMappingURL=util.js.map
