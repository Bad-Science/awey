import { ActorRealm, Registry } from "./actor";
import { BufferUniverse } from "../pixel/bufferuniverse";
import { actorSystem } from "./actor";

const bufferRealm = () => {
    const bufferUniverse = new BufferUniverse();
    ActorRealm.threadLocal.register(BufferUniverse.name, "BufferUnimatrix01", bufferUniverse);
    return [bufferUniverse];
}

actorSystem(() => ([
    () => [new Registry()],
    bufferRealm,
    () => []
]), __filename, (id) => {
    console.log(`realm ${id} initialized`);
});




import { MyTaskRunner } from "../tasks/my-task-runner";
import { MySharedState } from "../state/my-shared-state";
import { WebRoot } from "../web";
import { WebWorker } from "../web";

const appDef = {
  webRoot: (config: any) => new WebRoot(config),
  webWorker: () => new WebWorker(),
  taskRunner: () => new MyTaskRunner(),
  sharedState: () => new MySharedState(),
}

const appConfig = {
  ssl: {
    key: fs.readFileSync('./ssl/key.pem'),
    cert: fs.readFileSync('./ssl/cert.pem'),
  },
  port: 3000,
}

const myApp = () => {
  return [
    () => appDef.webRoot(appConfig),
    Array.from({length: 2}, () => appDef.webWorker),
    appDef.taskRunner,
    appDef.sharedState,
  ]
}