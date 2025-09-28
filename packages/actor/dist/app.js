var import_actor = require("./actor");
var import_bufferuniverse = require("../pixel/bufferuniverse");
var import_actor2 = require("./actor");
var import_my_task_runner = require("../tasks/my-task-runner");
var import_my_shared_state = require("../state/my-shared-state");
var import_web = require("../web");
var import_web2 = require("../web");
const bufferRealm = () => {
  const bufferUniverse = new import_bufferuniverse.BufferUniverse();
  import_actor.ActorRealm.threadLocal.register(import_bufferuniverse.BufferUniverse.name, "BufferUnimatrix01", bufferUniverse);
  return [bufferUniverse];
};
(0, import_actor2.actorSystem)(() => [
  () => [new import_actor.Registry()],
  bufferRealm,
  () => []
], __filename, (id) => {
  console.log(`realm ${id} initialized`);
});
const appDef = {
  webRoot: (config) => new import_web.WebRoot(config),
  webWorker: () => new import_web2.WebWorker(),
  taskRunner: () => new import_my_task_runner.MyTaskRunner(),
  sharedState: () => new import_my_shared_state.MySharedState()
};
const appConfig = {
  ssl: {
    key: fs.readFileSync("./ssl/key.pem"),
    cert: fs.readFileSync("./ssl/cert.pem")
  },
  port: 3e3
};
const myApp = () => [
  () => appDef.webRoot(appConfig),
  Array.from({ length: 2 }, () => appDef.webWorker),
  appDef.taskRunner,
  appDef.sharedState
];
threads(myApp);
//# sourceMappingURL=app.js.map
