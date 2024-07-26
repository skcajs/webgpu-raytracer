import { vec3 } from "gl-matrix"

export class Node {
    minCorner: vec3
    leftChild: number
    maxCorner: vec3
    sphereCount: number

    constructor() {
        this.minCorner = undefined!;
        this.maxCorner = undefined!;
        this.leftChild = undefined!;
        this.sphereCount = undefined!;
    }
}