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
var pubsub_exports = {};
__export(pubsub_exports, {
  ProcessPubSub: () => ProcessPubSub,
  PubSubBase: () => PubSubBase
});
module.exports = __toCommonJS(pubsub_exports);
class PubSubBase {
  subMap = /* @__PURE__ */ new Map();
  sub = (event, cb) => {
    const handle = Symbol(event);
    const entry = [handle, cb];
    if (!this.subMap.has(event)) {
      this.subMap.set(event, /* @__PURE__ */ new Map());
    }
    this.subMap.get(event).set(...entry);
    return handle;
  };
  unsub = (handle) => {
    for (let [_event, handlers] of this.subMap.entries()) {
      if (handlers.delete(handle))
        return true;
    }
    return false;
  };
  propagate = (event, message) => {
    const handlers = this.subMap.get(event);
    if (!handlers)
      return 0;
    for (let [_, cb] of handlers) {
      cb(message);
    }
    return handlers.size;
  };
}
class ProcessPubSub extends PubSubBase {
  channel;
  constructor(topic) {
    super();
    this.channel = new BroadcastChannel(topic);
    this.channel.addEventListener("message", (rawEvent) => {
      const { event, message } = rawEvent.data;
      this.propagate(event, message);
    });
  }
  pub = (event, message) => {
    this.channel.postMessage({ event, message });
  };
  close = () => {
    this.channel.close();
  };
}
;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ProcessPubSub,
  PubSubBase
});
//# sourceMappingURL=pubsub.js.map
