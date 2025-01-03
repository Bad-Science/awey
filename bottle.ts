import { AnyMessage } from "./actor";



export type Bottle



export class Bottle<T extends AnyMessage> {

    data: T;
    patch(data: Partial<T>) {
        this.data = 
    }
}