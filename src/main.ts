import './style.css'
import { Renderer } from './renderer'

const canvas: HTMLCanvasElement = <HTMLCanvasElement>document.getElementById('canvas');

// function resizeCanvas() {
//     canvas.width = window.innerWidth;
//     canvas.height = window.innerHeight;
// }

// window.addEventListener('resize', resizeCanvas);
// resizeCanvas(); // Initial resize to fill the screen

const renderer = new Renderer(canvas);

renderer.initialize();