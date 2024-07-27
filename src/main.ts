import './style.css'
import { Renderer } from './renderer'
import { Scene } from './scene';

const canvas: HTMLCanvasElement = <HTMLCanvasElement>document.getElementById('canvas');

const sphereCount: number = 1024;

const sphereCountLabel: HTMLElement = <HTMLElement>document.getElementById('sphere-count');
sphereCountLabel.innerText = sphereCount.toString();

const scene: Scene = new Scene(sphereCount);

const renderer = new Renderer(canvas, scene);

renderer.initialize();


// function resizeCanvas() {
//     canvas.width = window.innerWidth;
//     canvas.height = window.innerHeight;
//     // renderer.initialize();
// }

// window.addEventListener('resize', resizeCanvas);
// resizeCanvas(); // Initial resize to fill the screen