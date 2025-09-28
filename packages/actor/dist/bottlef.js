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
var bottlef_exports = {};
__export(bottlef_exports, {
  bottle: () => bottle,
  deepFreeze: () => deepFreeze,
  patch: () => patch
});
module.exports = __toCommonJS(bottlef_exports);
var import_actor = require("./actor");
const deepFreeze = (source, freezeParent = true) => {
  if (typeof source !== "object")
    return source;
  if (freezeParent)
    Object.freeze(source);
  Object.getOwnPropertyNames(source).forEach(function(prop) {
    if (Object.prototype.hasOwnProperty.call(source, prop) && source[prop] !== null && (typeof source[prop] === "object" || typeof source[prop] === "function")) {
      if (Object.isFrozen(source[prop])) {
        deepFreeze(source[prop], false);
      } else {
        deepFreeze(source[prop], true);
      }
    }
  });
  return source;
};
function bottle(data) {
  return deepFreeze(data);
}
function patch(bot2, update) {
  if (typeof bot2 === "object") {
    return bottle(Object.assign({}, bot2, update));
  } else {
    return bot2;
  }
}
const bot = bottle({ a: 1, b: 2 });
const patched = patch(bot, { a: 3 });
const simpleBot = bottle(1);
const simplePatched = patch(simpleBot, 2);
const sb2 = bottle(1);
const sb4 = bottle("hello");
const reg = new import_actor.Registry();
function facade(actor, self, prefix = import_actor.DEFAULT_PREFIX) {
  const keys = Object.getOwnPropertyNames(actor);
  const result = {};
  keys.forEach((key) => {
    const value = actor[key];
    if (typeof value === "function" && key.startsWith(prefix)) {
      result[key] = (arg) => {
        return (0, import_actor.send)(actor.self, key, arg, { from: self, prefix });
      };
    }
  });
  return result;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  bottle,
  deepFreeze,
  patch
});
//# sourceMappingURL=bottlef.js.map
