import { Actor } from "./actor";
import { Zone } from "./world";

export type BufferId = string;
export type Buffer = {
    id: BufferId;
    data: SharedArrayBuffer;
}
export type BufferKey = { id: BufferId };

export class BufferUniverse extends Actor {
    #buffers: WeakMap<BufferKey, Buffer> = new WeakMap();
    #bufferKeys: BufferKey[] = [];

    _findOrLoad(id: BufferId): Buffer {
        let buffer: Buffer | undefined;
        if (buffer = this.#buffers.get(this.bufferKey(id))) {
            return buffer;
        } else {
            return this.loadBuffer(id);
        }
    }

    async _save(id: BufferId): Promise<void> {
        // enhancement: save froma write actor on another thread.
        const buffer = this.#buffers.get(this.bufferKey(id));
        if (!buffer) {
            throw new Error(`Buffer ${id} does not exist`);
        }
        await this.saveBufferToDisk(buffer);
    }

    async _saveAll(): Promise<void> {
        for (const key of this.#bufferKeys) {
            await Actor.send(this.self as Pid<BufferUniverse>, 'save', key.id);
        }
    }

    private loadBuffer(id: BufferId): Buffer {
        const bufferExists = false;
        if (!bufferExists) {
            return this.createBuffer(id);
        } else {
            return this.createBuffer(id);
        }
    }

    private createBuffer(id: BufferId): Buffer {
        return {
            id,
            data: new SharedArrayBuffer(1024)
        }
    }

    private async saveBufferToDisk(buffer: Buffer): Promise<void> {
        // enhancement: save to disk on another thread.
    }

    private bufferKey(id: BufferId): BufferKey { return { id } }
}