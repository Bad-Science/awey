import { AnyMessage } from "./packages/actor/actor";



export type Bottle



export class Bottle<T extends AnyMessage> {

    data: T;
    patch(data: Partial<T>) {
        this.data = 
    }
}