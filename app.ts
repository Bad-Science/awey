import { ActorRealm, Registry } from "./packages/actor/actor";
import { BufferUniverse } from "./packages/pixel/bufferuniverse";
import { actorSystem } from "./packages/actor/actor";

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

