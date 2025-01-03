import { ActorRealm, Registry } from "./actor";
import { BufferUniverse } from "./bufferuniverse";
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

