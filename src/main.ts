import './style.css'
import { Renderer } from './renderer'
import { Scene } from './scene';

const canvas: HTMLCanvasElement = <HTMLCanvasElement>document.getElementById('canvas');

const scene: Scene = new Scene();

const renderer = new Renderer(canvas, scene);

renderer.initialize();


// function resizeCanvas() {
//     canvas.width = window.innerWidth;
//     canvas.height = window.innerHeight;
//     // renderer.initialize();
// }

// window.addEventListener('resize', resizeCanvas);
// resizeCanvas(); // Initial resize to fill the screen